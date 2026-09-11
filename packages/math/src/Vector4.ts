export class Vector4 {
  constructor(public x = 0, public y = 0, public z = 0, public w = 0) {}
  set(x: number, y: number, z: number, w: number): this { this.x = x; this.y = y; this.z = z; this.w = w; return this }
  copy(value: Vector4): this { return this.set(value.x, value.y, value.z, value.w) }
  clone(): Vector4 { return new Vector4(this.x, this.y, this.z, this.w) }
  multiplyScalar(value: number): this { return this.set(this.x * value, this.y * value, this.z * value, this.w * value) }
  dot(value: Vector4): number { return this.x * value.x + this.y * value.y + this.z * value.z + this.w * value.w }
}
