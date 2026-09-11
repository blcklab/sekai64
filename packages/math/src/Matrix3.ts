export class Matrix3 {
  readonly elements = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  identity(): this { this.elements.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return this }
  copy(value: Matrix3): this { this.elements.set(value.elements); return this }
  clone(): Matrix3 { return new Matrix3().copy(this) }
}
