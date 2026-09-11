import { Vector3 } from './Vector3.js'

export class Plane {
  readonly normal = new Vector3(1, 0, 0)
  constructor(normal?: Vector3, public constant = 0) { if (normal) this.normal.copy(normal) }
  setComponents(x: number, y: number, z: number, constant: number): this { this.normal.set(x, y, z); this.constant = constant; return this }
  normalize(): this { const inverse = 1 / this.normal.length(); this.normal.multiplyScalar(inverse); this.constant *= inverse; return this }
  distanceToPoint(point: Vector3): number { return this.normal.dot(point) + this.constant }
}
