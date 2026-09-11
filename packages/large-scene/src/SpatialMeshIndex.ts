import { Box3, Frustum, Ray, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, Mesh, type Scene } from '@sekai64-internal/scene'

interface Entry {
  mesh: Mesh
  bounds: Box3
  worldVersion: number
  geometryVersion: number
  instanceVersion: number
  center: Vector3
}

interface BvhNode {
  bounds: Box3
  left?: BvhNode
  right?: BvhNode
  entries?: Entry[]
  depth: number
}

export interface SpatialMeshIndexOptions {
  maxLeafEntries?: number
  includeInvisible?: boolean
}

export interface SpatialMeshIndexStats {
  entries: number
  nodes: number
  leaves: number
  depth: number
  buildMs: number
  updatedEntries: number
  topologyChanges: number
}

/** Hierarchical AABB index used by picking, region visibility, and streaming. */
export class SpatialMeshIndex {
  private readonly options: Required<SpatialMeshIndexOptions>
  private readonly entriesByMesh = new Map<Mesh, Entry>()
  private root?: BvhNode
  private statsValue: SpatialMeshIndexStats = { entries: 0, nodes: 0, leaves: 0, depth: 0, buildMs: 0, updatedEntries: 0, topologyChanges: 0 }

  constructor(options: SpatialMeshIndexOptions = {}) {
    this.options = {
      maxLeafEntries: Math.max(2, Math.min(64, Math.floor(options.maxLeafEntries ?? 8))),
      includeInvisible: options.includeInvisible ?? false,
    }
  }

  rebuild(scene: Scene): this {
    const started = now()
    scene.updateWorldMatrix()
    this.entriesByMesh.clear()
    scene.traverse(node => {
      if (!(node instanceof Mesh) || node.geometry.disposed || (!this.options.includeInvisible && !node.worldVisible)) return
      this.entriesByMesh.set(node, createEntry(node))
    })
    this.root = buildNode([...this.entriesByMesh.values()], 0, this.options.maxLeafEntries)
    this.statsValue = summarize(this.root, this.entriesByMesh.size, now() - started, this.entriesByMesh.size, this.entriesByMesh.size)
    return this
  }

  /** Updates changed bounds and rebuilds the BVH only when topology or transforms changed. */
  sync(scene: Scene): this {
    const started = now()
    scene.updateWorldMatrix()
    const seen = new Set<Mesh>()
    let updatedEntries = 0
    let topologyChanges = 0
    scene.traverse(node => {
      if (!(node instanceof Mesh) || node.geometry.disposed || (!this.options.includeInvisible && !node.worldVisible)) return
      seen.add(node)
      const existing = this.entriesByMesh.get(node)
      const instanceVersion = node instanceof InstancedMesh ? node.instanceVersion : -1
      if (!existing) {
        this.entriesByMesh.set(node, createEntry(node))
        topologyChanges += 1
        updatedEntries += 1
      } else if (existing.worldVersion !== node.worldVersion || existing.geometryVersion !== node.geometry.version || existing.instanceVersion !== instanceVersion) {
        updateEntry(existing, node)
        updatedEntries += 1
      }
    })
    for (const mesh of this.entriesByMesh.keys()) {
      if (seen.has(mesh)) continue
      this.entriesByMesh.delete(mesh)
      topologyChanges += 1
    }
    if (!this.root || updatedEntries > 0 || topologyChanges > 0) this.root = buildNode([...this.entriesByMesh.values()], 0, this.options.maxLeafEntries)
    this.statsValue = summarize(this.root, this.entriesByMesh.size, now() - started, updatedEntries, topologyChanges)
    return this
  }

  queryRay(ray: Ray, near = 0, far = Number.POSITIVE_INFINITY): readonly Mesh[] {
    const matches: Array<{ mesh: Mesh; distance: number }> = []
    this.walkRay(this.root, ray, near, far, matches)
    matches.sort((a, b) => a.distance - b.distance || a.mesh.id.localeCompare(b.mesh.id))
    return matches.map(match => match.mesh)
  }

  queryBox(bounds: Box3): readonly Mesh[] {
    const matches: Mesh[] = []
    this.walkBox(this.root, bounds, matches)
    return matches
  }

  queryFrustum(frustum: Frustum): readonly Mesh[] {
    const matches: Mesh[] = []
    this.walkFrustum(this.root, frustum, matches)
    return matches
  }

  queryPointRadius(point: Vector3, radius: number): readonly Mesh[] {
    const safeRadius = Math.max(0, radius)
    const bounds = new Box3(
      new Vector3(point.x - safeRadius, point.y - safeRadius, point.z - safeRadius),
      new Vector3(point.x + safeRadius, point.y + safeRadius, point.z + safeRadius),
    )
    return this.queryBox(bounds).filter(mesh => (this.entriesByMesh.get(mesh)?.bounds.distanceToPoint(point) ?? Number.POSITIVE_INFINITY) <= safeRadius)
  }

  getBounds(mesh: Mesh): Readonly<Box3> | undefined { return this.entriesByMesh.get(mesh)?.bounds }
  get size(): number { return this.entriesByMesh.size }
  get stats(): Readonly<SpatialMeshIndexStats> { return Object.freeze({ ...this.statsValue }) }

  clear(): void {
    this.entriesByMesh.clear()
    this.root = undefined
    this.statsValue = { entries: 0, nodes: 0, leaves: 0, depth: 0, buildMs: 0, updatedEntries: 0, topologyChanges: 0 }
  }

  private walkRay(node: BvhNode | undefined, ray: Ray, near: number, far: number, matches: Array<{ mesh: Mesh; distance: number }>): void {
    if (!node) return
    const nodeDistance = distanceToBox(ray, node.bounds)
    if (!Number.isFinite(nodeDistance) || nodeDistance > far) return
    if (node.entries) {
      for (const entry of node.entries) {
        const distance = distanceToBox(ray, entry.bounds)
        if (distance >= near && distance <= far) matches.push({ mesh: entry.mesh, distance })
      }
      return
    }
    this.walkRay(node.left, ray, near, far, matches)
    this.walkRay(node.right, ray, near, far, matches)
  }

  private walkBox(node: BvhNode | undefined, bounds: Box3, matches: Mesh[]): void {
    if (!node || !node.bounds.intersectsBox(bounds)) return
    if (node.entries) {
      for (const entry of node.entries) if (entry.bounds.intersectsBox(bounds)) matches.push(entry.mesh)
      return
    }
    this.walkBox(node.left, bounds, matches)
    this.walkBox(node.right, bounds, matches)
  }

  private walkFrustum(node: BvhNode | undefined, frustum: Frustum, matches: Mesh[]): void {
    if (!node || !frustum.intersectsBox(node.bounds)) return
    if (node.entries) {
      for (const entry of node.entries) if (frustum.intersectsBox(entry.bounds)) matches.push(entry.mesh)
      return
    }
    this.walkFrustum(node.left, frustum, matches)
    this.walkFrustum(node.right, frustum, matches)
  }
}

function createEntry(mesh: Mesh): Entry {
  const entry: Entry = { mesh, bounds: new Box3(), worldVersion: -1, geometryVersion: -1, instanceVersion: -1, center: new Vector3() }
  updateEntry(entry, mesh)
  return entry
}

function updateEntry(entry: Entry, mesh: Mesh): void {
  const localBounds = mesh instanceof InstancedMesh ? mesh.computeLocalBounds() : mesh.geometry.bounds
  entry.bounds.copy(localBounds).applyMatrix4(mesh.worldMatrix)
  entry.bounds.getCenter(entry.center)
  entry.worldVersion = mesh.worldVersion
  entry.geometryVersion = mesh.geometry.version
  entry.instanceVersion = mesh instanceof InstancedMesh ? mesh.instanceVersion : -1
}

function buildNode(entries: Entry[], depth: number, maximumLeafEntries: number): BvhNode | undefined {
  if (entries.length === 0) return undefined
  const bounds = new Box3().makeEmpty()
  for (const entry of entries) bounds.expandByBox(entry.bounds)
  if (entries.length <= maximumLeafEntries) return { bounds, entries, depth }
  const size = bounds.getSize(new Vector3())
  const axis: 'x' | 'y' | 'z' = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z'
  entries.sort((a, b) => a.center[axis] - b.center[axis] || a.mesh.id.localeCompare(b.mesh.id))
  const middle = Math.floor(entries.length / 2)
  const left = buildNode(entries.slice(0, middle), depth + 1, maximumLeafEntries)
  const right = buildNode(entries.slice(middle), depth + 1, maximumLeafEntries)
  return { bounds, ...(left ? { left } : {}), ...(right ? { right } : {}), depth }
}

function summarize(root: BvhNode | undefined, entries: number, buildMs: number, updatedEntries: number, topologyChanges: number): SpatialMeshIndexStats {
  let nodes = 0
  let leaves = 0
  let depth = 0
  const walk = (node: BvhNode | undefined): void => {
    if (!node) return
    nodes += 1
    depth = Math.max(depth, node.depth)
    if (node.entries) leaves += 1
    walk(node.left)
    walk(node.right)
  }
  walk(root)
  return { entries, nodes, leaves, depth, buildMs, updatedEntries, topologyChanges }
}

function distanceToBox(ray: Ray, bounds: Box3): number {
  const hit = ray.intersectBox(bounds, new Vector3())
  return hit ? hit.distanceTo(ray.origin) : Number.POSITIVE_INFINITY
}

function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }
