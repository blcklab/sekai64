import type { ChangeHandler } from './Vector2.js'
import type { Quaternion } from './Quaternion.js'

export type EulerOrder = 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY'

export class Euler {
  private _x: number
  private _y: number
  private _z: number
  private _order: EulerOrder
  private readonly changed?: ChangeHandler

  constructor(x = 0, y = 0, z = 0, order: EulerOrder = 'XYZ', onChange?: ChangeHandler) {
    this._x = x; this._y = y; this._z = z; this._order = order; this.changed = onChange
  }
  get x(): number { return this._x }
  set x(value: number) { this._x = value; this.changed?.() }
  get y(): number { return this._y }
  set y(value: number) { this._y = value; this.changed?.() }
  get z(): number { return this._z }
  set z(value: number) { this._z = value; this.changed?.() }
  get order(): EulerOrder { return this._order }
  set order(value: EulerOrder) { this._order = value; this.changed?.() }
  set(x: number, y: number, z: number, order = this._order): this { this._x = x; this._y = y; this._z = z; this._order = order; this.changed?.(); return this }
  copy(value: Euler): this { return this.set(value.x, value.y, value.z, value.order) }
  clone(): Euler { return new Euler(this._x, this._y, this._z, this._order) }
  setFromQuaternion(value: Quaternion): this {
    if (this._order !== 'XYZ') throw new Error(`Euler order ${this._order} is not implemented for quaternion conversion.`)
    const sinr = 2 * (value.w * value.x + value.y * value.z)
    const cosr = 1 - 2 * (value.x * value.x + value.y * value.y)
    const x = Math.atan2(sinr, cosr)
    const sinp = 2 * (value.w * value.y - value.z * value.x)
    const y = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp)
    const siny = 2 * (value.w * value.z + value.x * value.y)
    const cosy = 1 - 2 * (value.y * value.y + value.z * value.z)
    return this.set(x, y, Math.atan2(siny, cosy), this._order)
  }
}
