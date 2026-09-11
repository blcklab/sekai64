import type { ChangeHandler } from './Vector2.js'
import type { Matrix4 } from './Matrix4.js'

export class Vector3 {
  private _x: number
  private _y: number
  private _z: number
  private readonly changed?: ChangeHandler

  constructor(x = 0, y = 0, z = 0, onChange?: ChangeHandler) {
    this._x = x
    this._y = y
    this._z = z
    this.changed = onChange
  }

  get x(): number { return this._x }
  set x(value: number) { this._x = value; this.changed?.() }
  get y(): number { return this._y }
  set y(value: number) { this._y = value; this.changed?.() }
  get z(): number { return this._z }
  set z(value: number) { this._z = value; this.changed?.() }

  set(x: number, y: number, z: number): this { this._x = x; this._y = y; this._z = z; this.changed?.(); return this }
  setScalar(value: number): this { return this.set(value, value, value) }
  setComponent(index: number, value: number): this {
    if (index === 0) this.x = value
    else if (index === 1) this.y = value
    else if (index === 2) this.z = value
    else throw new RangeError(`Vector3 component index must be 0, 1, or 2; received ${index}.`)
    return this
  }
  getComponent(index: number): number {
    if (index === 0) return this._x
    if (index === 1) return this._y
    if (index === 2) return this._z
    throw new RangeError(`Vector3 component index must be 0, 1, or 2; received ${index}.`)
  }
  copy(value: Vector3): this { return this.set(value.x, value.y, value.z) }
  clone(): Vector3 { return new Vector3(this._x, this._y, this._z) }
  add(value: Vector3): this { return this.set(this._x + value.x, this._y + value.y, this._z + value.z) }
  addScalar(value: number): this { return this.set(this._x + value, this._y + value, this._z + value) }
  addScaledVector(value: Vector3, scale: number): this { return this.set(this._x + value.x * scale, this._y + value.y * scale, this._z + value.z * scale) }
  addVectors(a: Vector3, b: Vector3): this { return this.set(a.x + b.x, a.y + b.y, a.z + b.z) }
  sub(value: Vector3): this { return this.set(this._x - value.x, this._y - value.y, this._z - value.z) }
  subScalar(value: number): this { return this.set(this._x - value, this._y - value, this._z - value) }
  subVectors(a: Vector3, b: Vector3): this { return this.set(a.x - b.x, a.y - b.y, a.z - b.z) }
  multiply(value: Vector3): this { return this.set(this._x * value.x, this._y * value.y, this._z * value.z) }
  multiplyScalar(value: number): this { return this.set(this._x * value, this._y * value, this._z * value) }
  divide(value: Vector3): this { return this.set(this._x / value.x, this._y / value.y, this._z / value.z) }
  divideScalar(value: number): this { return value === 0 ? this.set(0, 0, 0) : this.multiplyScalar(1 / value) }
  min(value: Vector3): this { return this.set(Math.min(this._x, value.x), Math.min(this._y, value.y), Math.min(this._z, value.z)) }
  max(value: Vector3): this { return this.set(Math.max(this._x, value.x), Math.max(this._y, value.y), Math.max(this._z, value.z)) }
  clamp(minimum: Vector3, maximum: Vector3): this {
    return this.set(
      Math.max(minimum.x, Math.min(maximum.x, this._x)),
      Math.max(minimum.y, Math.min(maximum.y, this._y)),
      Math.max(minimum.z, Math.min(maximum.z, this._z))
    )
  }
  floor(): this { return this.set(Math.floor(this._x), Math.floor(this._y), Math.floor(this._z)) }
  ceil(): this { return this.set(Math.ceil(this._x), Math.ceil(this._y), Math.ceil(this._z)) }
  round(): this { return this.set(Math.round(this._x), Math.round(this._y), Math.round(this._z)) }
  negate(): this { return this.set(-this._x, -this._y, -this._z) }
  lengthSquared(): number { return this._x * this._x + this._y * this._y + this._z * this._z }
  length(): number { return Math.sqrt(this.lengthSquared()) }
  manhattanLength(): number { return Math.abs(this._x) + Math.abs(this._y) + Math.abs(this._z) }
  normalize(): this { const length = this.length(); return length > 0 ? this.multiplyScalar(1 / length) : this }
  setLength(length: number): this { const current = this.length(); return current > 0 ? this.multiplyScalar(length / current) : this }
  dot(value: Vector3): number { return this._x * value.x + this._y * value.y + this._z * value.z }
  cross(value: Vector3): this { return this.crossVectors(this, value) }
  crossVectors(a: Vector3, b: Vector3): this {
    const x = a.y * b.z - a.z * b.y
    const y = a.z * b.x - a.x * b.z
    const z = a.x * b.y - a.y * b.x
    return this.set(x, y, z)
  }
  angleTo(value: Vector3): number {
    const denominator = Math.sqrt(this.lengthSquared() * value.lengthSquared())
    if (denominator === 0) return Math.PI / 2
    return Math.acos(Math.max(-1, Math.min(1, this.dot(value) / denominator)))
  }
  distanceTo(value: Vector3): number { return Math.sqrt(this.distanceToSquared(value)) }
  distanceToSquared(value: Vector3): number {
    const x = this._x - value.x
    const y = this._y - value.y
    const z = this._z - value.z
    return x * x + y * y + z * z
  }
  lerp(value: Vector3, alpha: number): this {
    return this.set(
      this._x + (value.x - this._x) * alpha,
      this._y + (value.y - this._y) * alpha,
      this._z + (value.z - this._z) * alpha
    )
  }
  applyMatrix4(matrix: Matrix4): this {
    const e = matrix.elements
    const x = this._x, y = this._y, z = this._z
    const denominator = (e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 1)
    const w = denominator === 0 ? 1 : 1 / denominator
    return this.set(
      ((e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0)) * w,
      ((e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0)) * w,
      ((e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z + (e[14] ?? 0)) * w
    )
  }
  transformDirection(matrix: Matrix4): this {
    const e = matrix.elements
    const x = this._x, y = this._y, z = this._z
    return this.set(
      (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z,
      (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z,
      (e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z
    ).normalize()
  }
  setFromMatrixPosition(matrix: Matrix4): this {
    const e = matrix.elements
    return this.set(e[12] ?? 0, e[13] ?? 0, e[14] ?? 0)
  }
  equals(value: Vector3, epsilon = 1e-8): boolean {
    return Math.abs(this._x - value.x) <= epsilon && Math.abs(this._y - value.y) <= epsilon && Math.abs(this._z - value.z) <= epsilon
  }
  toArray(target: number[] | Float32Array = [], offset = 0): number[] | Float32Array {
    target[offset] = this._x; target[offset + 1] = this._y; target[offset + 2] = this._z; return target
  }
  fromArray(source: ArrayLike<number>, offset = 0): this {
    return this.set(source[offset] ?? 0, source[offset + 1] ?? 0, source[offset + 2] ?? 0)
  }
}
