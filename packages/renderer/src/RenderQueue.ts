import type { Camera } from '@sekai64-internal/cameras'
import type { Material } from '@sekai64-internal/materials'
import { Box3, Frustum, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, LevelOfDetail, Mesh, type Scene } from '@sekai64-internal/scene'
import type { RendererOptimizationOptions } from './VisualPipeline.js'
import { resolveOptimization } from './VisualPipeline.js'
import type { HierarchicalDepthCuller } from './AdvancedRendering.js'

export interface RenderItem {
  mesh: Mesh
  material: Material
  /** First index/vertex in this triangle-list draw range. */
  start: number
  /** Number of indices/vertices in this triangle-list draw range. */
  count: number
  /** Geometry group index, or -1 for an ungrouped full-mesh draw. */
  groupIndex: number
  groupName?: string
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
  private readonly shadowCasters: RenderItem[] = []
  private readonly itemPool: RenderItem[] = []
  private readonly shadowItemPool: RenderItem[] = []
  private readonly frustum = new Frustum()
  private readonly cameraPosition = new Vector3()
  private readonly center = new Vector3()
  private usedItems = 0
  private usedShadowItems = 0
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
      if (!(node instanceof Mesh) || !node.worldVisible || node.geometry.disposed || node.materials.every(material => material.disposed)) return
      const result = getWorldBounds(node, options.cachedBounds)
      boundsCacheHits += result.cached ? 1 : 0
      boundsCacheMisses += result.cached ? 0 : 1
      if (activeFrustum && !activeFrustum.intersectsBox(result.bounds)) {
        culled += 1
        frustumCulled += 1
        return
      }
      const drawGroups = resolveDrawGroups(node)
      const hasOpaque = drawGroups.some(group => !group.material.disposed && !group.material.transparent)
      if (options.hizOcclusion && occlusionCuller && hasOpaque) {
        occlusionCandidates += 1
        if (occlusionCuller.isOccluded(node, result.bounds)) {
          culled += 1
          occlusionCulled += 1
          return
        }
      }
      result.bounds.getCenter(this.center)
      const distanceSquared = this.center.distanceToSquared(this.cameraPosition)
      if (node instanceof InstancedMesh) {
        instancedMeshes += 1
        instances += node.count
      }
      if (node.tags.has('static-batch')) staticBatches += 1
      for (const group of drawGroups) {
        if (group.material.disposed) continue
        const item = this.allocateItem()
        item.mesh = node
        item.material = group.material
        item.start = group.start
        item.count = group.count
        item.groupIndex = group.groupIndex
        item.groupName = group.name
        item.worldBounds = result.bounds
        item.distanceSquared = distanceSquared
        item.pipelineKey = pipelineKey(node, group.material)
        if (group.material.transparent) this.transparent.push(item)
        else this.opaque.push(item)
      }
    })

    const sortStarted = now()
    this.transparent.sort((a, b) => b.distanceSquared - a.distanceSquared || a.material.sortBias - b.material.sortBias || a.pipelineKey.localeCompare(b.pipelineKey))
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


  /**
   * Collects opaque shadow casters independently of the main camera visibility queue.
   *
   * Directional-light shadows must not depend on whether a caster is currently inside
   * the viewer's frustum: an off-screen tree/building can still project a shadow onto
   * visible ground. Keeping this list separate prevents camera-relative shadow popping
   * and swimming when the player moves or rotates the view.
   */
  buildShadowCasters(scene: Scene, configuration: Partial<RendererOptimizationOptions> = {}): readonly RenderItem[] {
    const options = resolveOptimization(configuration)
    this.shadowCasters.length = 0
    this.usedShadowItems = 0

    scene.traverse(node => {
      if (!(node instanceof Mesh) || !node.worldVisible || node.geometry.disposed) return
      if (!node.castShadow) return
      const result = getWorldBounds(node, options.cachedBounds)
      for (const group of resolveDrawGroups(node)) {
        if (group.material.disposed || group.material.transparent) continue
        const item = this.allocateShadowItem()
        item.mesh = node
        item.material = group.material
        item.start = group.start
        item.count = group.count
        item.groupIndex = group.groupIndex
        item.groupName = group.name
        item.worldBounds = result.bounds
        item.distanceSquared = 0
        item.pipelineKey = ''
        this.shadowCasters.push(item)
      }
    })

    return this.shadowCasters
  }

  private allocateItem(): RenderItem {
    let item = this.itemPool[this.usedItems]
    if (!item) {
      item = { mesh: undefined as unknown as Mesh, material: undefined as unknown as Material, start: 0, count: 0, groupIndex: -1, distanceSquared: 0, worldBounds: new Box3(), pipelineKey: '' }
      this.itemPool.push(item)
      this.itemAllocations += 1
    }
    this.usedItems += 1
    return item
  }


  private allocateShadowItem(): RenderItem {
    let item = this.shadowItemPool[this.usedShadowItems]
    if (!item) {
      item = { mesh: undefined as unknown as Mesh, material: undefined as unknown as Material, start: 0, count: 0, groupIndex: -1, distanceSquared: 0, worldBounds: new Box3(), pipelineKey: '' }
      this.shadowItemPool.push(item)
    }
    this.usedShadowItems += 1
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

function resolveDrawGroups(mesh: Mesh): readonly { start: number; count: number; material: Material; groupIndex: number; name?: string }[] {
  const groups = mesh.geometry.groups
  const fullCount = mesh.geometry.indices ? mesh.geometry.indices.length : mesh.geometry.positions.length / 3
  if (groups.length === 0) return [{ start: 0, count: fullCount, material: mesh.material, groupIndex: -1 }]
  return groups.map((group, groupIndex) => ({
    start: group.start,
    count: group.count,
    material: mesh.materialForGroup(group.materialIndex, group.name),
    groupIndex,
    ...(group.name ? { name: group.name } : {}),
  }))
}

function pipelineKey(mesh: Mesh, material: Material): string {
  let materialId = materialIds.get(material)
  if (!materialId) {
    materialId = nextMaterialId++
    materialIds.set(material, materialId)
  }
  const state = material as unknown as { version: number; shadingModel?: string; alphaMode?: string; side: string; transparent: boolean; depthWrite?: boolean }
  const cached = pipelineCache.get(material)
  if (cached && cached.version === state.version && cached.side === state.side && cached.transparent === state.transparent) {
    return `${mesh instanceof InstancedMesh ? 'i' : 'm'}:${cached.key}`
  }
  const key = [state.shadingModel ?? material.constructor.name, state.alphaMode ?? (state.transparent ? 'blend' : 'opaque'), state.side, state.depthWrite === false ? 'no-depth-write' : 'depth-write', materialId].join(':')
  pipelineCache.set(material, { version: state.version, side: state.side, transparent: state.transparent, key })
  return `${mesh instanceof InstancedMesh ? 'i' : 'm'}:${key}`
}

function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }
