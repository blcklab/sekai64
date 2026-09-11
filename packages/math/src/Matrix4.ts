import type { Euler } from './Euler.js'
import type { Vector3 } from './Vector3.js'

export class Matrix4 {
  readonly elements = new Float32Array(16)

  constructor() { this.identity() }

  set(...values: readonly number[]): this {
    if (values.length !== 16) throw new Error('Matrix4.set requires 16 values.')
    for (let i = 0; i < 16; i += 1) this.elements[i] = values[i] ?? 0
    return this
  }

  identity(): this {
    return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
  }

  copy(value: Matrix4): this { this.elements.set(value.elements); return this }
  clone(): Matrix4 { return new Matrix4().copy(this) }
  multiply(value: Matrix4): this { return this.multiplyMatrices(this, value) }
  premultiply(value: Matrix4): this { return this.multiplyMatrices(value, this) }

  multiplyMatrices(a: Matrix4, b: Matrix4): this {
    const ae = a.elements, be = b.elements, te = this.elements
    const a11 = ae[0] ?? 0, a12 = ae[4] ?? 0, a13 = ae[8] ?? 0, a14 = ae[12] ?? 0
    const a21 = ae[1] ?? 0, a22 = ae[5] ?? 0, a23 = ae[9] ?? 0, a24 = ae[13] ?? 0
    const a31 = ae[2] ?? 0, a32 = ae[6] ?? 0, a33 = ae[10] ?? 0, a34 = ae[14] ?? 0
    const a41 = ae[3] ?? 0, a42 = ae[7] ?? 0, a43 = ae[11] ?? 0, a44 = ae[15] ?? 0
    const b11 = be[0] ?? 0, b12 = be[4] ?? 0, b13 = be[8] ?? 0, b14 = be[12] ?? 0
    const b21 = be[1] ?? 0, b22 = be[5] ?? 0, b23 = be[9] ?? 0, b24 = be[13] ?? 0
    const b31 = be[2] ?? 0, b32 = be[6] ?? 0, b33 = be[10] ?? 0, b34 = be[14] ?? 0
    const b41 = be[3] ?? 0, b42 = be[7] ?? 0, b43 = be[11] ?? 0, b44 = be[15] ?? 0
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44
    return this
  }

  compose(position: Vector3, rotation: Euler, scale: Vector3): this {
    const x = rotation.x, y = rotation.y, z = rotation.z
    const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z)
    const ae = a * e, af = a * f, be = b * e, bf = b * f
    const te = this.elements

    if (rotation.order === 'XYZ') {
      te[0] = c * e * scale.x
      te[4] = -c * f * scale.y
      te[8] = d * scale.z
      te[1] = (af + be * d) * scale.x
      te[5] = (ae - bf * d) * scale.y
      te[9] = -b * c * scale.z
      te[2] = (bf - ae * d) * scale.x
      te[6] = (be + af * d) * scale.y
      te[10] = a * c * scale.z
    } else if (rotation.order === 'YXZ') {
      // Camera-friendly yaw (Y), pitch (X), roll (Z) order. With roll = 0,
      // yaw and pitch stay independent and the local -Z axis remains a stable
      // view direction around a Y-up world.
      te[0] = (c * e + d * bf) * scale.x
      te[4] = (d * be - c * f) * scale.y
      te[8] = a * d * scale.z
      te[1] = a * f * scale.x
      te[5] = a * e * scale.y
      te[9] = -b * scale.z
      te[2] = (c * bf - d * e) * scale.x
      te[6] = (d * f + c * be) * scale.y
      te[10] = a * c * scale.z
    } else {
      throw new Error(`Euler order ${rotation.order} is not implemented in Sekai64.`)
    }

    te[3] = 0; te[7] = 0; te[11] = 0
    te[12] = position.x; te[13] = position.y; te[14] = position.z; te[15] = 1
    return this
  }

  invert(): this {
    const te = this.elements
    const n11 = te[0] ?? 0, n21 = te[1] ?? 0, n31 = te[2] ?? 0, n41 = te[3] ?? 0
    const n12 = te[4] ?? 0, n22 = te[5] ?? 0, n32 = te[6] ?? 0, n42 = te[7] ?? 0
    const n13 = te[8] ?? 0, n23 = te[9] ?? 0, n33 = te[10] ?? 0, n43 = te[11] ?? 0
    const n14 = te[12] ?? 0, n24 = te[13] ?? 0, n34 = te[14] ?? 0, n44 = te[15] ?? 0
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34
    const determinant = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14
    if (determinant === 0) throw new Error('Matrix4 cannot be inverted because its determinant is zero.')
    const detInv = 1 / determinant
    te[0] = t11 * detInv
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv
    te[4] = t12 * detInv
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv
    te[8] = t13 * detInv
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv
    te[12] = t14 * detInv
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv
    return this
  }

  makePerspective(fieldOfViewRadians: number, aspect: number, near: number, far: number): this {
    const f = 1 / Math.tan(fieldOfViewRadians / 2)
    const rangeInverse = 1 / (near - far)
    return this.set(
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * rangeInverse, -1,
      0, 0, 2 * far * near * rangeInverse, 0
    )
  }

  makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): this {
    const width = 1 / (right - left), height = 1 / (top - bottom), depth = 1 / (far - near)
    return this.set(
      2 * width, 0, 0, 0,
      0, 2 * height, 0, 0,
      0, 0, -2 * depth, 0,
      -(right + left) * width, -(top + bottom) * height, -(far + near) * depth, 1
    )
  }
}
