import type { Euler } from './Euler.js'

export class Quaternion {
  constructor(public x = 0, public y = 0, public z = 0, public w = 1) {}
  set(x: number, y: number, z: number, w: number): this { this.x = x; this.y = y; this.z = z; this.w = w; return this }
  identity(): this { return this.set(0, 0, 0, 1) }
  copy(value: Quaternion): this { return this.set(value.x, value.y, value.z, value.w) }
  clone(): Quaternion { return new Quaternion(this.x, this.y, this.z, this.w) }
  dot(value: Quaternion): number { return this.x * value.x + this.y * value.y + this.z * value.z + this.w * value.w }
  fromArray(source: ArrayLike<number>, offset = 0): this { return this.set(source[offset] ?? 0, source[offset + 1] ?? 0, source[offset + 2] ?? 0, source[offset + 3] ?? 1) }
  toArray(target: number[] | Float32Array = [], offset = 0): number[] | Float32Array { target[offset] = this.x; target[offset + 1] = this.y; target[offset + 2] = this.z; target[offset + 3] = this.w; return target }
  slerp(value: Quaternion, alpha: number): this {
    let bx = value.x, by = value.y, bz = value.z, bw = value.w
    let cosine = this.x * bx + this.y * by + this.z * bz + this.w * bw
    if (cosine < 0) { cosine = -cosine; bx = -bx; by = -by; bz = -bz; bw = -bw }
    if (cosine > 0.9995) return this.set(this.x + (bx - this.x) * alpha, this.y + (by - this.y) * alpha, this.z + (bz - this.z) * alpha, this.w + (bw - this.w) * alpha).normalize()
    const theta = Math.acos(Math.max(-1, Math.min(1, cosine)))
    const sine = Math.sin(theta)
    if (Math.abs(sine) < 1e-8) return this
    const a = Math.sin((1 - alpha) * theta) / sine
    const b = Math.sin(alpha * theta) / sine
    return this.set(this.x * a + bx * b, this.y * a + by * b, this.z * a + bz * b, this.w * a + bw * b)
  }
  normalize(): this {
    const length = Math.hypot(this.x, this.y, this.z, this.w)
    if (length === 0) return this.identity()
    const inverse = 1 / length
    return this.set(this.x * inverse, this.y * inverse, this.z * inverse, this.w * inverse)
  }
  multiply(value: Quaternion): this { return this.multiplyQuaternions(this, value) }
  multiplyQuaternions(a: Quaternion, b: Quaternion): this {
    const ax = a.x, ay = a.y, az = a.z, aw = a.w
    const bx = b.x, by = b.y, bz = b.z, bw = b.w
    return this.set(
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    )
  }
  setFromEuler(euler: Euler): this {
    const c1 = Math.cos(euler.x / 2), c2 = Math.cos(euler.y / 2), c3 = Math.cos(euler.z / 2)
    const s1 = Math.sin(euler.x / 2), s2 = Math.sin(euler.y / 2), s3 = Math.sin(euler.z / 2)
    if (euler.order !== 'XYZ') throw new Error(`Euler order ${euler.order} is not implemented in Sekai64 0.1.0.`)
    return this.set(
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 + s1 * s2 * c3,
      c1 * c2 * c3 - s1 * s2 * s3
    )
  }
}
