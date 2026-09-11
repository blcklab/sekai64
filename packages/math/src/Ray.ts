import type { Box3 } from './Box3.js'
import { Vector3 } from './Vector3.js'

export class Ray {
  readonly origin = new Vector3()
  readonly direction = new Vector3(0, 0, -1)

  constructor(origin?: Vector3, direction?: Vector3) { if (origin) this.origin.copy(origin); if (direction) this.direction.copy(direction).normalize() }
  set(origin: Vector3, direction: Vector3): this { this.origin.copy(origin); this.direction.copy(direction).normalize(); return this }
  copy(value: Ray): this { return this.set(value.origin, value.direction) }
  clone(): Ray { return new Ray(this.origin, this.direction) }
  at(distance: number, target = new Vector3()): Vector3 { return target.copy(this.direction).multiplyScalar(distance).add(this.origin) }
  closestPointToPoint(point: Vector3, target = new Vector3()): Vector3 {
    const distance = target.subVectors(point, this.origin).dot(this.direction)
    return distance < 0 ? target.copy(this.origin) : this.at(distance, target)
  }
  distanceSqToPoint(point: Vector3): number { return this.closestPointToPoint(point, new Vector3()).distanceToSquared(point) }
  intersectBox(box: Box3, target = new Vector3()): Vector3 | null {
    let tMin = Number.NEGATIVE_INFINITY
    let tMax = Number.POSITIVE_INFINITY
    for (let axis = 0; axis < 3; axis += 1) {
      const origin = this.origin.getComponent(axis)
      const direction = this.direction.getComponent(axis)
      const minimum = box.min.getComponent(axis)
      const maximum = box.max.getComponent(axis)
      if (Math.abs(direction) < 1e-12) {
        if (origin < minimum || origin > maximum) return null
        continue
      }
      const inverse = 1 / direction
      let near = (minimum - origin) * inverse
      let far = (maximum - origin) * inverse
      if (near > far) [near, far] = [far, near]
      tMin = Math.max(tMin, near)
      tMax = Math.min(tMax, far)
      if (tMax < tMin) return null
    }
    const distance = tMin >= 0 ? tMin : tMax
    return distance >= 0 ? this.at(distance, target) : null
  }
}
