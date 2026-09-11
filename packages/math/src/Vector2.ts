export type ChangeHandler = () => void

export class Vector2 {
  private _x: number
  private _y: number
  private readonly changed?: ChangeHandler

  constructor(x = 0, y = 0, onChange?: ChangeHandler) {
    this._x = x
    this._y = y
    this.changed = onChange
  }

  get x(): number { return this._x }
  set x(value: number) { this._x = value; this.changed?.() }
  get y(): number { return this._y }
  set y(value: number) { this._y = value; this.changed?.() }

  set(x: number, y: number): this { this._x = x; this._y = y; this.changed?.(); return this }
  copy(value: Vector2): this { return this.set(value.x, value.y) }
  clone(): Vector2 { return new Vector2(this._x, this._y) }
  add(value: Vector2): this { return this.set(this._x + value.x, this._y + value.y) }
  sub(value: Vector2): this { return this.set(this._x - value.x, this._y - value.y) }
  multiplyScalar(value: number): this { return this.set(this._x * value, this._y * value) }
  lengthSquared(): number { return this._x * this._x + this._y * this._y }
  length(): number { return Math.sqrt(this.lengthSquared()) }
  normalize(): this { const length = this.length(); return length > 0 ? this.multiplyScalar(1 / length) : this }
  dot(value: Vector2): number { return this._x * value.x + this._y * value.y }
  toArray(target: number[] = [], offset = 0): number[] { target[offset] = this._x; target[offset + 1] = this._y; return target }
}
