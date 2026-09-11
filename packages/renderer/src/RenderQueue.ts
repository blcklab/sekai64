import type { Camera } from '@sekai64-internal/cameras'
import { Box3, Frustum, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, LevelOfDetail, Mesh, type Scene } from '@sekai64-internal/scene'
import type { RendererOptimizationOptions } from './VisualPipeline.js'
import { resolveOptimization } from './VisualPipeline.js'
import type { HierarchicalDepthCuller } from './AdvancedRendering.js'

export interface RenderItem {
  mesh: Mesh
  distanceSquared: number
  worldBounds: Box3
  pipelineKey: string
}

export interface RenderQueue {
  opaque: RenderItem[]
  transparent: RenderItem[]
  culled: number
  frustumCulled: number
  boundsCacheHits: number
  boundsCacheMisses: number
  occlusionCulled: number
  occlusionCandidates: number
  instancedMeshes: number
  instances: number
  staticBatches: number
  lodSwitches: number
  lodLevelCounts: readonly number[]
  buildMs: number
  sortMs: number
  itemAllocations: number
  itemPoolSize: number
}

interface BoundsCacheEntry {
  worldVersion: number
  geometryVersion: number
  instanceVersion: number
  bounds: Box3
}

interface PipelineCacheEntry {
  version: number
  side: string
  transparent: boolean
  key: string
}

const boundsCache = new WeakMap<Mesh, BoundsCacheEntry>()
const materialIds = new WeakMap<object, number>()
const pipelineCache = new WeakMap<object, PipelineCacheEntry>()
let nextMaterialId = 1

/**
 * Reusable render-queue builder. Renderer backends should keep one instance so camera
 * movement does not allocate fresh frustums, vectors, queue arrays, or render items.
 */
export class RenderQueueBuilder {
  private readonly opaque: RenderItem[] = []
  private readonly transparent: RenderItem[] = []
  private readonly itemPool: RenderItem[] = []
  private readonly frustum = new Frustum()
  private readonly cameraPosition = new Vector3()
  private readonly center = new Vector3()
  private usedItems = 0
  private itemAllocations = 0

  build(scene: Scene, camera: Camera, configuration: Partial<RendererOptimizationOptions> = {}, occlusionCuller?: HierarchicalDepthCuller, viewportHeight = 1080): RenderQueue {
    const started = now()
    const options = resolveOptimization(configuration)
    this.opaque.length = 0
    this.transparent.length = 0
    this.usedItems = 0
    this.itemAllocations = 0
    let culled = 0
    let frustumCulled = 0
    let occlusionCulled = 0
    let occlusionCandidates = 0
    let boundsCacheHits = 0
    let boundsCacheMisses = 0
    let instancedMeshes = 0
    let instances = 0
    let staticBatches = 0
    let lodSwitches = 0
    const lodLevelCounts: number[] = []

    this.cameraPosition.setFromMatrixPosition(camera.worldMatrix)
    const projectionScaleY = camera.projectionMatrix.elements[5] ?? 1

    // Select LODs before the visibility walk. A second dirty-only transform update is
    // needed only when a selection changes.
    scene.traverse(node => {
      if (!(node instanceof LevelOfDetail)) return
      const previous = node.selectedIndex
      node.updateForCamera(this.cameraPosition, options.lodHysteresis, { viewportHeight, projectionScaleY })
      if (node.selectedIndex !== previous) lodSwitches += 1
      if (node.selectedIndex >= 0) lodLevelCounts[node.selectedIndex] = (lodLevelCounts[node.selectedIndex] ?? 0) + 1
    })
    if (lodSwitches > 0) scene.updateWorldMatrix()

    const activeFrustum = options.frustumCulling ? this.frustum.setFromProjectionMatrix(camera.viewProjectionMatrix) : undefined
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !node.worldVisible || node.geometry.disposed || node.material.disposed) return
      const result = getWorldBounds(node, options.cachedBounds)
      boundsCacheHits += result.cached ? 1 : 0
      boundsCacheMisses += result.cached ? 0 : 1
      if (activeFrustum && !activeFrustum.intersectsBox(result.bounds)) {
        culled += 1
        frustumCulled += 1
        return
      }
      if (options.hizOcclusion && occlusionCuller && !node.material.transparent) {
        occlusionCandidates += 1
        if (occlusionCuller.isOccluded(node, result.bounds)) {
          culled += 1
          occlusionCulled += 1
          return
        }
      }
      result.bounds.getCenter(this.center)
      const item = this.allocateItem()
      item.mesh = node
      item.worldBounds = result.bounds
      item.distanceSquared = this.center.distanceToSquared(this.cameraPosition)
      item.pipelineKey = pipelineKey(node)
      if (node instanceof InstancedMesh) {
        instancedMeshes += 1
        instances += node.count
      }
      if (node.tags.has('static-batch')) staticBatches += 1
      if (node.material.transparent) this.transparent.push(item)
      else this.opaque.push(item)
    })

    const sortStarted = now()
    this.transparent.sort((a, b) => b.distanceSquared - a.distanceSquared || a.mesh.material.sortBias - b.mesh.material.sortBias || a.pipelineKey.localeCompare(b.pipelineKey))
    if (options.pipelineSorting) this.opaque.sort((a, b) => a.pipelineKey.localeCompare(b.pipelineKey) || a.distanceSquared - b.distanceSquared)
    else this.opaque.sort((a, b) => a.distanceSquared - b.distanceSquared)
    const sortMs = now() - sortStarted

    if (options.hizOcclusion && occlusionCuller) {
      for (const item of this.opaque) occlusionCuller.submitOccluder(item.mesh, item.worldBounds)
      occlusionCuller.endFrame()
    }

    return {
      opaque: this.opaque,
      transparent: this.transparent,
      culled,
      frustumCulled,
      boundsCacheHits,
      boundsCacheMisses,
      occlusionCulled,
      occlusionCandidates,
      instancedMeshes,
      instances,
      staticBatches,
      lodSwitches,
      lodLevelCounts,
      buildMs: now() - started,
      sortMs,
      itemAllocations: this.itemAllocations,
      itemPoolSize: this.itemPool.length,
    }
  }

  private allocateItem(): RenderItem {
    let item = this.itemPool[this.usedItems]
    if (!item) {
      item = { mesh: undefined as unknown as Mesh, distanceSquared: 0, worldBounds: new Box3(), pipelineKey: '' }
      this.itemPool.push(item)
      this.itemAllocations += 1
    }
    this.usedItems += 1
    return item
  }
}

const compatibilityBuilder = new RenderQueueBuilder()

export function buildRenderQueue(scene: Scene, camera: Camera, configuration: Partial<RendererOptimizationOptions> = {}, occlusionCuller?: HierarchicalDepthCuller, viewportHeight = 1080): RenderQueue {
  return compatibilityBuilder.build(scene, camera, configuration, occlusionCuller, viewportHeight)
}

export function clearRenderBoundsCache(mesh?: Mesh): void {
  if (mesh) boundsCache.delete(mesh)
  // WeakMap entries are version-invalidated and disappear with their mesh.
}

function getWorldBounds(mesh: Mesh, useCache: boolean): { bounds: Box3; cached: boolean } {
  const geometryVersion = mesh.geometry.version
  const instanceVersion = mesh instanceof InstancedMesh ? mesh.instanceVersion : -1
  const cached = useCache ? boundsCache.get(mesh) : undefined
  if (cached && cached.worldVersion === mesh.worldVersion && cached.geometryVersion === geometryVersion && cached.instanceVersion === instanceVersion) {
    return { bounds: cached.bounds, cached: true }
  }
  const localBounds = mesh instanceof InstancedMesh ? mesh.computeLocalBounds() : mesh.geometry.bounds
  const bounds = cached?.bounds ?? new Box3()
  bounds.copy(localBounds).applyMatrix4(mesh.worldMatrix)
  if (useCache) boundsCache.set(mesh, { worldVersion: mesh.worldVersion, geometryVersion, instanceVersion, bounds })
  return { bounds, cached: false }
}

function pipelineKey(mesh: Mesh): string {
  let materialId = materialIds.get(mesh.material)
  if (!materialId) {
    materialId = nextMaterialId++
    materialIds.set(mesh.material, materialId)
  }
  const material = mesh.material as unknown as { version: number; shadingModel?: string; alphaMode?: string; side: string; transparent: boolean; depthWrite?: boolean }
  const cached = pipelineCache.get(mesh.material)
  if (cached && cached.version === material.version && cached.side === material.side && cached.transparent === material.transparent) {
    return `${mesh instanceof InstancedMesh ? 'i' : 'm'}:${cached.key}`
  }
  const key = [material.shadingModel ?? mesh.material.constructor.name, material.alphaMode ?? (material.transparent ? 'blend' : 'opaque'), material.side, material.depthWrite === false ? 'no-depth-write' : 'depth-write', materialId].join(':')
  pipelineCache.set(mesh.material, { version: material.version, side: material.side, transparent: material.transparent, key })
  return `${mesh instanceof InstancedMesh ? 'i' : 'm'}:${key}`
}

function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }
