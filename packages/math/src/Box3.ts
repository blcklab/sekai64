import type { Matrix4 } from './Matrix4.js'
import { Vector3 } from './Vector3.js'

const corners = Array.from({ length: 8 }, () => new Vector3())

export class Box3 {
  readonly min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
  readonly max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)

  constructor(min?: Vector3, max?: Vector3) { if (min) this.min.copy(min); if (max) this.max.copy(max) }

  set(min: Vector3, max: Vector3): this { this.min.copy(min); this.max.copy(max); return this }
  copy(value: Box3): this { return this.set(value.min, value.max) }
  clone(): Box3 { return new Box3().copy(this) }
  makeEmpty(): this { this.min.set(Infinity, Infinity, Infinity); this.max.set(-Infinity, -Infinity, -Infinity); return this }
  isEmpty(): boolean { return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z }
  expandByPoint(point: Vector3): this { this.min.min(point); this.max.max(point); return this }
  expandByScalar(value: number): this { this.min.addScalar(-value); this.max.addScalar(value); return this }
  expandByBox(box: Box3): this { this.min.min(box.min); this.max.max(box.max); return this }
  setFromArray(values: ArrayLike<number>): this {
    this.makeEmpty()
    for (let i = 0; i < values.length; i += 3) this.expandByPoint(new Vector3(values[i] ?? 0, values[i + 1] ?? 0, values[i + 2] ?? 0))
    return this
  }
  getCenter(target = new Vector3()): Vector3 { return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5) }
  getSize(target = new Vector3()): Vector3 { return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min) }
  containsPoint(point: Vector3): boolean { return point.x >= this.min.x && point.x <= this.max.x && point.y >= this.min.y && point.y <= this.max.y && point.z >= this.min.z && point.z <= this.max.z }
  containsBox(box: Box3): boolean { return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y && this.min.z <= box.min.z && box.max.z <= this.max.z }
  intersectsBox(box: Box3): boolean { return !(box.max.x < this.min.x || box.min.x > this.max.x || box.max.y < this.min.y || box.min.y > this.max.y || box.max.z < this.min.z || box.min.z > this.max.z) }
  clampPoint(point: Vector3, target = new Vector3()): Vector3 { return target.copy(point).clamp(this.min, this.max) }
  distanceToPoint(point: Vector3): number { return this.clampPoint(point, corners[0]).distanceTo(point) }
  translate(offset: Vector3): this { this.min.add(offset); this.max.add(offset); return this }
  applyMatrix4(matrix: Matrix4): this {
    if (this.isEmpty()) return this
    const min = this.min.clone()
    const max = this.max.clone()
    corners[0]!.set(min.x, min.y, min.z).applyMatrix4(matrix)
    corners[1]!.set(min.x, min.y, max.z).applyMatrix4(matrix)
    corners[2]!.set(min.x, max.y, min.z).applyMatrix4(matrix)
    corners[3]!.set(min.x, max.y, max.z).applyMatrix4(matrix)
    corners[4]!.set(max.x, min.y, min.z).applyMatrix4(matrix)
    corners[5]!.set(max.x, min.y, max.z).applyMatrix4(matrix)
    corners[6]!.set(max.x, max.y, min.z).applyMatrix4(matrix)
    corners[7]!.set(max.x, max.y, max.z).applyMatrix4(matrix)
    this.makeEmpty()
    for (const corner of corners) this.expandByPoint(corner)
    return this
  }
}
