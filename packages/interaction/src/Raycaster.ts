import type { Camera } from '@sekai64-internal/cameras'
import { Matrix4, Ray, Vector2, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, Mesh, type Node, type Scene } from '@sekai64-internal/scene'

export type RaycastPrecision = 'bounds' | 'triangles'

export interface RaycastHit {
  object: Mesh
  point: Vector3
  normal: Vector3
  distance: number
  triangleIndex?: number
  /** Interpolated TEXCOORD_0 at the triangle hit. */
  uv?: Vector2
  /** Interpolated TEXCOORD_1 at the triangle hit. */
  uv1?: Vector2
  instanceId?: number
}

export interface RaycastOptions {
  recursive?: boolean
  layerMask?: number
  firstHitOnly?: boolean
  near?: number
  far?: number
  /** Triangle precision is the default. Use bounds for large non-interactive architecture. */
  precision?: RaycastPrecision
}

export class Raycaster {
  readonly ray = new Ray()
  near = 0
  far = Number.POSITIVE_INFINITY
  layerMask = 0xffffffff
  precision: RaycastPrecision = 'triangles'
  private readonly inverse = new Matrix4()
  private readonly combined = new Matrix4()
  private readonly instanceMatrix = new Matrix4()
  private readonly localRay = new Ray()
  private readonly localPoint = new Vector3()
  private readonly worldPoint = new Vector3()
  private readonly localNormal = new Vector3()
  private readonly a = new Vector3()
  private readonly b = new Vector3()
  private readonly c = new Vector3()
  private readonly edge1 = new Vector3()
  private readonly edge2 = new Vector3()
  private readonly pvec = new Vector3()
  private readonly tvec = new Vector3()
  private readonly qvec = new Vector3()

  setFromCamera(pointer: Vector2 | readonly [number, number], camera: Camera): this {
    camera.updateMatrices()
    const x = pointer instanceof Vector2 ? pointer.x : pointer[0]
    const y = pointer instanceof Vector2 ? pointer.y : pointer[1]
    const inverseViewProjection = camera.viewProjectionMatrix.clone().invert()
    const nearPoint = new Vector3(x, y, -1).applyMatrix4(inverseViewProjection)
    const farPoint = new Vector3(x, y, 1).applyMatrix4(inverseViewProjection)
    this.ray.set(nearPoint, farPoint.sub(nearPoint))
    return this
  }

  intersectScene(scene: Scene, options: RaycastOptions = {}): RaycastHit[] {
    scene.updateWorldMatrix()
    return this.intersectObjects(scene.children, options)
  }

  intersectObjects(objects: readonly Node[], options: RaycastOptions = {}): RaycastHit[] {
    const hits: RaycastHit[] = []
    const recursive = options.recursive ?? true
    const layerMask = options.layerMask ?? this.layerMask
    const near = options.near ?? this.near
    const far = options.far ?? this.far
    const precision = options.precision ?? this.precision
    const visit = (node: Node): void => {
      if (!node.worldVisible || (node.layerMask & layerMask) === 0) return
      if (node instanceof Mesh && !node.geometry.disposed) {
        const meshHits = this.intersectMeshAll(node, precision)
        for (const hit of meshHits) if (hit.distance >= near && hit.distance <= far) hits.push(hit)
      }
      if (recursive) for (const child of node.children) visit(child)
    }
    for (const object of objects) visit(object)
    hits.sort((a, b) => a.distance - b.distance)
    return options.firstHitOnly && hits.length > 0 ? [hits[0] as RaycastHit] : hits
  }

  /** Backward-compatible nearest hit for one mesh. */
  intersectMesh(mesh: Mesh, precision: RaycastPrecision = this.precision): RaycastHit | null {
    const hits = this.intersectMeshAll(mesh, precision)
    hits.sort((a, b) => a.distance - b.distance)
    return hits[0] ?? null
  }

  /** Returns all instance hits for an instanced mesh, or at most one hit for a regular mesh. */
  intersectMeshAll(mesh: Mesh, precision: RaycastPrecision = this.precision): RaycastHit[] {
    if (mesh instanceof InstancedMesh) return this.intersectInstancedMesh(mesh, precision)
    const hit = this.intersectTransformedGeometry(mesh, mesh.worldMatrix, precision)
    return hit ? [hit] : []
  }

  private intersectInstancedMesh(mesh: InstancedMesh, precision: RaycastPrecision): RaycastHit[] {
    const hits: RaycastHit[] = []
    for (let instanceId = 0; instanceId < mesh.count; instanceId += 1) {
      mesh.getMatrixAt(instanceId, this.instanceMatrix)
      this.combined.multiplyMatrices(mesh.worldMatrix, this.instanceMatrix)
      const hit = this.intersectTransformedGeometry(mesh, this.combined, precision)
      if (hit) hits.push({ ...hit, instanceId })
    }
    return hits
  }

  private intersectTransformedGeometry(mesh: Mesh, worldMatrix: Matrix4, precision: RaycastPrecision): RaycastHit | null {
    this.inverse.copy(worldMatrix).invert()
    this.localRay.origin.copy(this.ray.origin).applyMatrix4(this.inverse)
    this.localPoint.copy(this.ray.origin).add(this.ray.direction).applyMatrix4(this.inverse)
    this.localRay.direction.subVectors(this.localPoint, this.localRay.origin).normalize()
    const boundsPoint = this.localRay.intersectBox(mesh.geometry.bounds, this.localPoint)
    if (!boundsPoint) return null
    if (precision === 'bounds') {
      this.worldPoint.copy(boundsPoint).applyMatrix4(worldMatrix)
      return {
        object: mesh,
        point: this.worldPoint.clone(),
        normal: boxNormal(mesh.geometry.bounds.min, mesh.geometry.bounds.max, boundsPoint, this.localNormal).transformDirection(worldMatrix).clone(),
        distance: this.worldPoint.distanceTo(this.ray.origin)
      }
    }
    return this.intersectTriangles(mesh, worldMatrix)
  }

  private intersectTriangles(mesh: Mesh, worldMatrix: Matrix4): RaycastHit | null {
    const geometry = mesh.geometry
    const positions = geometry.positions
    const indices = geometry.indices
    const triangleCount = geometry.triangleCount
    let closestDistance = Number.POSITIVE_INFINITY
    let closestTriangle = -1
    const closestPoint = new Vector3()
    const closestNormal = new Vector3()
    const closestUv = new Vector2()
    const closestUv1 = new Vector2()
    let hasUv = false
    let hasUv1 = false

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const offset = triangle * 3
      const ia = indices ? indices[offset] : offset
      const ib = indices ? indices[offset + 1] : offset + 1
      const ic = indices ? indices[offset + 2] : offset + 2
      if (ia === undefined || ib === undefined || ic === undefined) continue
      readPosition(positions, ia, this.a)
      readPosition(positions, ib, this.b)
      readPosition(positions, ic, this.c)
      const intersection = intersectTriangle(this.localRay, this.a, this.b, this.c, this.edge1, this.edge2, this.pvec, this.tvec, this.qvec)
      if (intersection === null) continue
      this.localRay.at(intersection.distance, this.localPoint)
      this.worldPoint.copy(this.localPoint).applyMatrix4(worldMatrix)
      const worldDistance = this.worldPoint.distanceTo(this.ray.origin)
      if (worldDistance >= closestDistance) continue
      closestDistance = worldDistance
      closestTriangle = triangle
      closestPoint.copy(this.worldPoint)
      closestNormal.subVectors(this.b, this.a).cross(this.edge2.subVectors(this.c, this.a)).normalize().transformDirection(worldMatrix)
      hasUv = interpolateUv(geometry.uvs, ia, ib, ic, intersection.u, intersection.v, closestUv)
      hasUv1 = interpolateUv(geometry.uvs1, ia, ib, ic, intersection.u, intersection.v, closestUv1)
    }

    if (closestTriangle < 0) return null
    return {
      object: mesh,
      point: closestPoint,
      normal: closestNormal,
      distance: closestDistance,
      triangleIndex: closestTriangle,
      ...(hasUv ? { uv: closestUv.clone() } : {}),
      ...(hasUv1 ? { uv1: closestUv1.clone() } : {}),
    }
  }
}

function readPosition(positions: Float32Array, index: number, target: Vector3): Vector3 {
  const offset = index * 3
  return target.set(positions[offset] ?? 0, positions[offset + 1] ?? 0, positions[offset + 2] ?? 0)
}

function intersectTriangle(
  ray: Ray,
  a: Vector3,
  b: Vector3,
  c: Vector3,
  edge1: Vector3,
  edge2: Vector3,
  pvec: Vector3,
  tvec: Vector3,
  qvec: Vector3
): { distance: number; u: number; v: number } | null {
  edge1.subVectors(b, a)
  edge2.subVectors(c, a)
  pvec.crossVectors(ray.direction, edge2)
  const determinant = edge1.dot(pvec)
  if (Math.abs(determinant) < 1e-9) return null
  const inverseDeterminant = 1 / determinant
  tvec.subVectors(ray.origin, a)
  const u = tvec.dot(pvec) * inverseDeterminant
  if (u < 0 || u > 1) return null
  qvec.crossVectors(tvec, edge1)
  const v = ray.direction.dot(qvec) * inverseDeterminant
  if (v < 0 || u + v > 1) return null
  const distance = edge2.dot(qvec) * inverseDeterminant
  return distance >= 0 ? { distance, u, v } : null
}

function interpolateUv(
  uvs: Float32Array | undefined,
  ia: number,
  ib: number,
  ic: number,
  u: number,
  v: number,
  target: Vector2,
): boolean {
  if (!uvs) return false
  const w = 1 - u - v
  const a = ia * 2
  const b = ib * 2
  const c = ic * 2
  target.set(
    (uvs[a] ?? 0) * w + (uvs[b] ?? 0) * u + (uvs[c] ?? 0) * v,
    (uvs[a + 1] ?? 0) * w + (uvs[b + 1] ?? 0) * u + (uvs[c + 1] ?? 0) * v,
  )
  return true
}

function boxNormal(min: Vector3, max: Vector3, point: Vector3, target: Vector3): Vector3 {
  const epsilon = 1e-5
  if (Math.abs(point.x - min.x) < epsilon) return target.set(-1, 0, 0)
  if (Math.abs(point.x - max.x) < epsilon) return target.set(1, 0, 0)
  if (Math.abs(point.y - min.y) < epsilon) return target.set(0, -1, 0)
  if (Math.abs(point.y - max.y) < epsilon) return target.set(0, 1, 0)
  if (Math.abs(point.z - min.z) < epsilon) return target.set(0, 0, -1)
  return target.set(0, 0, 1)
}
