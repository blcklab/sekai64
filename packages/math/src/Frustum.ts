import { Plane } from './Plane.js'
import type { Box3 } from './Box3.js'
import type { Matrix4 } from './Matrix4.js'
import { Vector3 } from './Vector3.js'

export class Frustum {
  readonly planes = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane(), new Plane()] as const
  setFromProjectionMatrix(matrix: Matrix4): this {
    const m = matrix.elements
    this.planes[0].setComponents((m[3] ?? 0) - (m[0] ?? 0), (m[7] ?? 0) - (m[4] ?? 0), (m[11] ?? 0) - (m[8] ?? 0), (m[15] ?? 0) - (m[12] ?? 0)).normalize()
    this.planes[1].setComponents((m[3] ?? 0) + (m[0] ?? 0), (m[7] ?? 0) + (m[4] ?? 0), (m[11] ?? 0) + (m[8] ?? 0), (m[15] ?? 0) + (m[12] ?? 0)).normalize()
    this.planes[2].setComponents((m[3] ?? 0) + (m[1] ?? 0), (m[7] ?? 0) + (m[5] ?? 0), (m[11] ?? 0) + (m[9] ?? 0), (m[15] ?? 0) + (m[13] ?? 0)).normalize()
    this.planes[3].setComponents((m[3] ?? 0) - (m[1] ?? 0), (m[7] ?? 0) - (m[5] ?? 0), (m[11] ?? 0) - (m[9] ?? 0), (m[15] ?? 0) - (m[13] ?? 0)).normalize()
    this.planes[4].setComponents((m[3] ?? 0) - (m[2] ?? 0), (m[7] ?? 0) - (m[6] ?? 0), (m[11] ?? 0) - (m[10] ?? 0), (m[15] ?? 0) - (m[14] ?? 0)).normalize()
    this.planes[5].setComponents((m[3] ?? 0) + (m[2] ?? 0), (m[7] ?? 0) + (m[6] ?? 0), (m[11] ?? 0) + (m[10] ?? 0), (m[15] ?? 0) + (m[14] ?? 0)).normalize()
    return this
  }
  intersectsBox(box: Box3): boolean {
    const point = new Vector3()
    for (const plane of this.planes) {
      point.set(plane.normal.x > 0 ? box.max.x : box.min.x, plane.normal.y > 0 ? box.max.y : box.min.y, plane.normal.z > 0 ? box.max.z : box.min.z)
      if (plane.distanceToPoint(point) < 0) return false
    }
    return true
  }
}
