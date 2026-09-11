import type { Camera } from '@sekai64-internal/cameras'
import { Box3, Matrix4, Vector3 } from '@sekai64-internal/math'

export interface ClusteredPointLight {
  id?: string
  priority?: number
  static?: boolean
  castShadow?: boolean
  positionRange: readonly [number, number, number, number]
  colorDecay: readonly [number, number, number, number]
}

export interface GtaoKernelSample {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly weight: number
}

/** Deterministic cosine-weighted hemisphere kernel used by GTAO backends and tests. */
export function createGtaoKernel(sampleCount = 12): readonly GtaoKernelSample[] {
  const count = Math.max(4, Math.min(32, Math.floor(sampleCount)))
  const golden = Math.PI * (3 - Math.sqrt(5))
  const samples: GtaoKernelSample[] = []
  for (let index = 0; index < count; index += 1) {
    const ratio = (index + 0.5) / count
    const radius = Math.sqrt(ratio)
    const angle = index * golden
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    const z = Math.sqrt(Math.max(0, 1 - radius * radius))
    samples.push(Object.freeze({ x, y, z, weight: 0.25 + 0.75 * ratio * ratio }))
  }
  return Object.freeze(samples)
}

export interface BloomPyramidLevel {
  readonly index: number
  readonly width: number
  readonly height: number
  readonly weight: number
}

/** Plans a multi-resolution bloom chain with normalized scatter weights. */
export function createBloomPyramid(width: number, height: number, levels = 4, scatter = 0.7): readonly BloomPyramidLevel[] {
  const count = Math.max(1, Math.min(8, Math.floor(levels)))
  const safeScatter = Math.max(0, Math.min(1, scatter))
  const output: BloomPyramidLevel[] = []
  let total = 0
  for (let index = 0; index < count; index += 1) {
    const weight = Math.pow(safeScatter || 0.0001, index)
    total += weight
    output.push({ index, width: Math.max(1, Math.floor(width / 2 ** (index + 1))), height: Math.max(1, Math.floor(height / 2 ** (index + 1))), weight })
  }
  return Object.freeze(output.map(level => Object.freeze({ ...level, weight: level.weight / Math.max(total, 0.0001) })))
}

interface ProjectedBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  nearDepth: number
  farDepth: number
  valid: boolean
}

/**
 * Conservative previous-frame hierarchical depth culler.
 *
 * It rasterizes opaque world bounds into a small CPU depth surface, builds a max-depth
 * pyramid, and tests the next frame's bounds against it. It never reads GPU depth and is
 * deliberately conservative: only sufficiently large, fully covered bounds are rejected.
 */
export interface HierarchicalDepthCullerOptions {
  baseResolution?: number
  depthBias?: number
  /** Consecutive previous-frame occlusion results required before rejecting a mesh. */
  historyFrames?: number
  minimumProjectedPixels?: number
}

/**
 * Conservative previous-frame hierarchical depth culler with visibility history.
 * Bounds must remain occluded for multiple frames before rejection, which prevents
 * one-frame camera cuts and thin occluders from producing visible popping.
 */
export class HierarchicalDepthCuller {
  private previous: readonly Float32Array[] = []
  private currentBase = new Float32Array(0)
  private width = 0
  private height = 0
  private readonly projection = new Matrix4()
  private readonly history = new WeakMap<object, { streak: number; lastFrame: number }>()
  private viewportWidth = 1
  private viewportHeight = 1
  private submitted = 0
  private rejected = 0
  private provisional = 0
  private candidates = 0
  private frame = 0
  readonly baseResolution: number
  readonly depthBias: number
  readonly historyFrames: number
  readonly minimumProjectedPixels: number

  constructor(options: number | HierarchicalDepthCullerOptions = 64, depthBias = 0.003) {
    const resolved = typeof options === 'number' ? { baseResolution: options, depthBias } : options
    this.baseResolution = Math.max(16, Math.floor(resolved.baseResolution ?? 64))
    this.depthBias = Math.max(0, resolved.depthBias ?? 0.003)
    this.historyFrames = Math.max(1, Math.min(8, Math.floor(resolved.historyFrames ?? 2)))
    this.minimumProjectedPixels = Math.max(1, Math.floor(resolved.minimumProjectedPixels ?? 3))
  }

  beginFrame(camera: Camera, viewportWidth: number, viewportHeight: number): void {
    this.frame += 1
    this.viewportWidth = Math.max(1, viewportWidth)
    this.viewportHeight = Math.max(1, viewportHeight)
    const aspect = this.viewportWidth / this.viewportHeight
    this.width = this.baseResolution
    this.height = Math.max(8, Math.round(this.width / Math.max(0.25, aspect)))
    const length = this.width * this.height
    if (this.currentBase.length !== length) this.currentBase = new Float32Array(length)
    this.currentBase.fill(1)
    this.projection.copy(camera.viewProjectionMatrix)
    this.submitted = 0
    this.rejected = 0
    this.provisional = 0
    this.candidates = 0
  }

  isOccluded(bounds: Box3): boolean
  isOccluded(key: object, bounds: Box3): boolean
  isOccluded(keyOrBounds: object | Box3, optionalBounds?: Box3): boolean {
    const bounds = optionalBounds ?? keyOrBounds as Box3
    const key = optionalBounds ? keyOrBounds : undefined
    this.candidates += 1
    if (this.previous.length === 0) return this.updateHistory(key, false)
    const projected = projectBounds(bounds, this.projection, this.width, this.height)
    if (!projected.valid || projected.nearDepth <= 0 || projected.nearDepth >= 1) return this.updateHistory(key, false)
    const pixelWidth = projected.maxX - projected.minX + 1
    const pixelHeight = projected.maxY - projected.minY + 1
    if (pixelWidth < this.minimumProjectedPixels || pixelHeight < this.minimumProjectedPixels) return this.updateHistory(key, false)
    const levelIndex = Math.max(0, Math.min(this.previous.length - 1, Math.floor(Math.log2(Math.max(1, Math.min(pixelWidth, pixelHeight)))) - 1))
    const level = this.previous[levelIndex]
    if (!level) return this.updateHistory(key, false)
    const levelWidth = Math.max(1, this.width >> levelIndex)
    const levelHeight = Math.max(1, this.height >> levelIndex)
    const scale = 2 ** levelIndex
    const minX = Math.max(0, Math.floor(projected.minX / scale))
    const maxX = Math.min(levelWidth - 1, Math.floor(projected.maxX / scale))
    const minY = Math.max(0, Math.floor(projected.minY / scale))
    const maxY = Math.min(levelHeight - 1, Math.floor(projected.maxY / scale))
    let maximumOccluderDepth = 0
    let covered = true
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const depth = level[y * levelWidth + x] ?? 1
        if (depth >= 0.99999) { covered = false; break }
        maximumOccluderDepth = Math.max(maximumOccluderDepth, depth)
      }
      if (!covered) break
    }
    return this.updateHistory(key, covered && projected.nearDepth > maximumOccluderDepth + this.depthBias)
  }

  submitOccluder(bounds: Box3): void
  submitOccluder(_key: object, bounds: Box3): void
  submitOccluder(keyOrBounds: object | Box3, optionalBounds?: Box3): void {
    const bounds = optionalBounds ?? keyOrBounds as Box3
    const projected = projectBounds(bounds, this.projection, this.width, this.height)
    if (!projected.valid || projected.farDepth <= 0 || projected.nearDepth >= 1) return
    const minX = Math.max(0, Math.ceil(projected.minX + 0.75))
    const maxX = Math.min(this.width - 1, Math.floor(projected.maxX - 0.75))
    const minY = Math.max(0, Math.ceil(projected.minY + 0.75))
    const maxY = Math.min(this.height - 1, Math.floor(projected.maxY - 0.75))
    if (maxX - minX < 2 || maxY - minY < 2) return
    const conservativeDepth = Math.max(0, Math.min(1, projected.farDepth))
    for (let y = minY; y <= maxY; y += 1) {
      const row = y * this.width
      for (let x = minX; x <= maxX; x += 1) {
        const offset = row + x
        this.currentBase[offset] = Math.min(this.currentBase[offset] ?? 1, conservativeDepth)
      }
    }
    this.submitted += 1
  }

  endFrame(): void {
    const levels: Float32Array[] = [this.currentBase.slice()]
    let source = levels[0] as Float32Array
    let sourceWidth = this.width
    let sourceHeight = this.height
    while (sourceWidth > 1 || sourceHeight > 1) {
      const width = Math.max(1, Math.ceil(sourceWidth / 2))
      const height = Math.max(1, Math.ceil(sourceHeight / 2))
      const target = new Float32Array(width * height)
      target.fill(1)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let maximum = 0
          for (let oy = 0; oy < 2; oy += 1) for (let ox = 0; ox < 2; ox += 1) {
            const sx = Math.min(sourceWidth - 1, x * 2 + ox)
            const sy = Math.min(sourceHeight - 1, y * 2 + oy)
            maximum = Math.max(maximum, source[sy * sourceWidth + sx] ?? 1)
          }
          target[y * width + x] = maximum
        }
      }
      levels.push(target)
      source = target
      sourceWidth = width
      sourceHeight = height
    }
    this.previous = Object.freeze(levels)
  }

  get stats(): Readonly<{ submitted: number; rejected: number; provisional: number; candidates: number; levels: number }> {
    return Object.freeze({ submitted: this.submitted, rejected: this.rejected, provisional: this.provisional, candidates: this.candidates, levels: this.previous.length })
  }

  reset(): void { this.previous = []; this.currentBase = new Float32Array(0) }

  private updateHistory(key: object | undefined, rawOccluded: boolean): boolean {
    if (!key) {
      if (rawOccluded) this.rejected += 1
      return rawOccluded
    }
    const previous = this.history.get(key)
    const streak = rawOccluded ? (previous?.streak ?? 0) + 1 : 0
    this.history.set(key, { streak, lastFrame: this.frame })
    const rejected = rawOccluded && streak >= this.historyFrames
    if (rejected) this.rejected += 1
    else if (rawOccluded) this.provisional += 1
    return rejected
  }
}

export interface ClusteredLightGridOptions {
  dimensions?: readonly [number, number, number]
  maxLightsPerCluster?: number
  /** Global cap before cluster assignment. Highest-importance lights win. */
  maxVisibleLights?: number
}

export interface ClusteredLightGridStats {
  buildMs: number
  cacheHits: number
  totalLights: number
  visibleLights: number
  rejectedLights: number
  assignedLightReferences: number
  overflowReferences: number
  maximumClusterOccupancy: number
  clusterCount: number
  gpuBufferBytes: number
}

interface ScoredLight { index: number; score: number }

/** CPU forward+ grid with stable importance selection and upload-ready buffers. */
export class ClusteredLightGrid {
  readonly dimensions: readonly [number, number, number]
  readonly maxLightsPerCluster: number
  readonly maxVisibleLights: number
  private cells: ScoredLight[][] = []
  private lights: readonly ClusteredPointLight[] = []
  private camera?: Camera
  private readonly selectionCenter = new Vector3()
  private lastSignature = ''
  private cacheHitsValue = 0
  private buildMsValue = 0
  private rejectedLightsValue = 0
  private overflowReferencesValue = 0
  private maximumClusterOccupancyValue = 0

  constructor(options: ClusteredLightGridOptions = {}) {
    const source = options.dimensions ?? [16, 9, 24]
    this.dimensions = [Math.max(1, Math.floor(source[0])), Math.max(1, Math.floor(source[1])), Math.max(1, Math.floor(source[2]))]
    this.maxLightsPerCluster = Math.max(1, Math.min(64, Math.floor(options.maxLightsPerCluster ?? 8)))
    this.maxVisibleLights = Math.max(this.maxLightsPerCluster, Math.min(4096, Math.floor(options.maxVisibleLights ?? 1024)))
  }

  build(camera: Camera, inputLights: readonly ClusteredPointLight[]): void {
    const signature = gridSignature(camera, inputLights, this.dimensions, this.maxLightsPerCluster)
    if (signature === this.lastSignature) {
      this.cacheHitsValue += 1
      return
    }
    const started = nowAdvanced()
    this.lastSignature = signature
    this.camera = camera
    this.rejectedLightsValue = 0
    this.overflowReferencesValue = 0
    this.maximumClusterOccupancyValue = 0
    const cameraWorld = new Vector3().setFromMatrixPosition(camera.worldMatrix)
    const ranked = inputLights.map((light, index) => ({ light, index, score: lightImportance(light, cameraWorld) }))
      .sort((a, b) => b.score - a.score || stableLightId(a.light, a.index).localeCompare(stableLightId(b.light, b.index)))
    const selected = ranked.slice(0, this.maxVisibleLights)
    this.rejectedLightsValue = Math.max(0, ranked.length - selected.length)
    this.lights = selected.map(entry => entry.light)

    const [columns, rows, slices] = this.dimensions
    this.cells = Array.from({ length: columns * rows * slices }, () => [])
    const projection = camera.projectionMatrix.elements
    const tanHalfX = 1 / Math.max(0.0001, Math.abs(projection[0] ?? 1))
    const tanHalfY = 1 / Math.max(0.0001, Math.abs(projection[5] ?? 1))
    const view = camera.viewMatrix
    for (let lightIndex = 0; lightIndex < this.lights.length; lightIndex += 1) {
      const light = this.lights[lightIndex]
      if (!light) continue
      const world = light.positionRange
      const position = new Vector3(world[0], world[1], world[2]).applyMatrix4(view)
      const range = Math.max(0.001, world[3])
      const depth = -position.z
      if (depth + range < camera.near || depth - range > camera.far) { this.rejectedLightsValue += 1; continue }
      const safeDepth = Math.max(camera.near, depth)
      const minNdcX = (position.x - range) / Math.max(0.0001, safeDepth * tanHalfX)
      const maxNdcX = (position.x + range) / Math.max(0.0001, safeDepth * tanHalfX)
      const minNdcY = (position.y - range) / Math.max(0.0001, safeDepth * tanHalfY)
      const maxNdcY = (position.y + range) / Math.max(0.0001, safeDepth * tanHalfY)
      const minX = clampIndex(Math.floor((minNdcX * 0.5 + 0.5) * columns), columns)
      const maxX = clampIndex(Math.floor((maxNdcX * 0.5 + 0.5) * columns), columns)
      const minY = clampIndex(Math.floor((minNdcY * 0.5 + 0.5) * rows), rows)
      const maxY = clampIndex(Math.floor((maxNdcY * 0.5 + 0.5) * rows), rows)
      const minZ = depthSlice(Math.max(camera.near, depth - range), camera.near, camera.far, slices)
      const maxZ = depthSlice(Math.min(camera.far, depth + range), camera.near, camera.far, slices)
      const score = lightImportance(light, cameraWorld)
      for (let z = minZ; z <= maxZ; z += 1) for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const cell = this.cells[(z * rows + y) * columns + x]
        if (!cell) continue
        if (insertScoredLight(cell, { index: lightIndex, score }, this.maxLightsPerCluster)) this.overflowReferencesValue += 1
        this.maximumClusterOccupancyValue = Math.max(this.maximumClusterOccupancyValue, cell.length)
      }
    }
    this.buildMsValue = nowAdvanced() - started
  }

  selectForBounds(bounds: Box3, target: ClusteredPointLight[] = [], maximum = this.maxLightsPerCluster): readonly ClusteredPointLight[] {
    target.length = 0
    const camera = this.camera
    if (!camera || this.cells.length === 0) {
      for (let index = 0; index < Math.min(maximum, this.lights.length); index += 1) {
        const light = this.lights[index]
        if (light) target.push(light)
      }
      return target
    }
    const center = bounds.getCenter(this.selectionCenter).applyMatrix4(camera.viewMatrix)
    const projection = camera.projectionMatrix.elements
    const depth = Math.max(camera.near, -center.z)
    const ndcX = center.x * (projection[0] ?? 1) / depth
    const ndcY = center.y * (projection[5] ?? 1) / depth
    const [columns, rows, slices] = this.dimensions
    const x = clampIndex(Math.floor((ndcX * 0.5 + 0.5) * columns), columns)
    const y = clampIndex(Math.floor((ndcY * 0.5 + 0.5) * rows), rows)
    const z = depthSlice(depth, camera.near, camera.far, slices)
    const cell = this.cells[(z * rows + y) * columns + x] ?? []
    for (let index = 0; index < Math.min(maximum, cell.length); index += 1) {
      const light = this.lights[cell[index]?.index ?? -1]
      if (light) target.push(light)
    }
    return target
  }

  createGpuBuffers(): Readonly<{ offsets: Uint32Array; indices: Uint32Array; lights: Float32Array }> {
    const offsets = new Uint32Array(this.cells.length + 1)
    const indices = new Uint32Array(this.assignedLightReferences)
    let cursor = 0
    for (let index = 0; index < this.cells.length; index += 1) {
      offsets[index] = cursor
      const cell = this.cells[index] ?? []
      for (const entry of cell) indices[cursor++] = entry.index
    }
    offsets[this.cells.length] = cursor
    const lights = new Float32Array(this.lights.length * 8)
    for (let index = 0; index < this.lights.length; index += 1) {
      const light = this.lights[index]
      if (!light) continue
      lights.set(light.positionRange, index * 8)
      lights.set(light.colorDecay, index * 8 + 4)
    }
    return Object.freeze({ offsets, indices, lights })
  }

  get clusterCount(): number { return this.cells.length }
  get assignedLightReferences(): number { return this.cells.reduce((sum, cell) => sum + cell.length, 0) }
  get stats(): Readonly<ClusteredLightGridStats> {
    const gpuBufferBytes = (this.cells.length + 1 + this.assignedLightReferences) * 4 + this.lights.length * 8 * 4
    return Object.freeze({
      buildMs: this.buildMsValue,
      cacheHits: this.cacheHitsValue,
      totalLights: this.lights.length + this.rejectedLightsValue,
      visibleLights: this.lights.length,
      rejectedLights: this.rejectedLightsValue,
      assignedLightReferences: this.assignedLightReferences,
      overflowReferences: this.overflowReferencesValue,
      maximumClusterOccupancy: this.maximumClusterOccupancyValue,
      clusterCount: this.clusterCount,
      gpuBufferBytes,
    })
  }
}

export { batchStaticMeshes, type StaticBatchOptions, type StaticBatchResult } from '@sekai64-internal/scene'

export interface ResourceResidencyEntry<T> {
  readonly key: T
  bytes: number
  lastUsedFrame: number
  pinned: boolean
  evict: () => void
}

/** Backend-neutral LRU accounting used by WebGL2/WebGPU texture caches. */
export class ResourceResidencyManager<T extends object> {
  private readonly entries = new Map<T, ResourceResidencyEntry<T>>()
  constructor(public budgetBytes = 384 * 1024 * 1024, public minimumUnusedFrames = 180) {}
  touch(key: T, bytes: number, frame: number, evict: () => void, pinned = false): void {
    const entry = this.entries.get(key)
    if (entry) { entry.bytes = bytes; entry.lastUsedFrame = frame; entry.pinned = pinned; entry.evict = evict }
    else this.entries.set(key, { key, bytes, lastUsedFrame: frame, pinned, evict })
  }
  remove(key: T): void { this.entries.delete(key) }
  enforce(frame: number): number {
    if (this.budgetBytes <= 0) return 0
    let total = this.totalBytes
    if (total <= this.budgetBytes) return 0
    const candidates = [...this.entries.values()].filter(entry => !entry.pinned && frame - entry.lastUsedFrame >= this.minimumUnusedFrames).sort((a, b) => a.lastUsedFrame - b.lastUsedFrame || b.bytes - a.bytes)
    let evicted = 0
    for (const entry of candidates) {
      if (total <= this.budgetBytes) break
      this.entries.delete(entry.key)
      entry.evict()
      total -= entry.bytes
      evicted += 1
    }
    return evicted
  }
  get totalBytes(): number { let total = 0; for (const entry of this.entries.values()) total += entry.bytes; return total }
  get size(): number { return this.entries.size }
  clear(evict = false): void { if (evict) for (const entry of this.entries.values()) entry.evict(); this.entries.clear() }
}

/** Backward-compatible texture-specific name. */
export class TextureResidencyManager<T extends object> extends ResourceResidencyManager<T> {}
/** Geometry and buffer residency use the same backend-neutral LRU policy. */
export class GeometryResidencyManager<T extends object> extends ResourceResidencyManager<T> {}

function insertScoredLight(cell: ScoredLight[], entry: ScoredLight, maximum: number): boolean {
  const existing = cell.findIndex(value => value.index === entry.index)
  if (existing >= 0) return false
  let insertion = cell.findIndex(value => entry.score > value.score)
  if (insertion < 0) insertion = cell.length
  cell.splice(insertion, 0, entry)
  const overflowed = cell.length > maximum
  if (overflowed) cell.length = maximum
  return overflowed
}

function lightImportance(light: ClusteredPointLight, reference: Vector3): number {
  const position = light.positionRange
  const dx = position[0] - reference.x
  const dy = position[1] - reference.y
  const dz = position[2] - reference.z
  const distanceSquared = dx * dx + dy * dy + dz * dz
  const color = light.colorDecay
  const luminance = Math.max(0, color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722)
  const range = Math.max(0.001, position[3])
  const priority = Math.max(-1000, Math.min(1000, light.priority ?? 0))
  return luminance * range * range / Math.max(1, distanceSquared) + priority * 1000 + (light.castShadow ? 100 : 0)
}

function stableLightId(light: ClusteredPointLight, index: number): string { return light.id ?? `light-${index.toString().padStart(8, '0')}` }

function gridSignature(camera: Camera, lights: readonly ClusteredPointLight[], dimensions: readonly [number, number, number], maximum: number): string {
  const matrix = camera.viewProjectionMatrix.elements
  let hash = 2166136261
  const mix = (value: number): void => { hash ^= Math.round(value * 1000); hash = Math.imul(hash, 16777619) }
  for (let index = 0; index < 16; index += 1) mix(matrix[index] ?? 0)
  mix(dimensions[0]); mix(dimensions[1]); mix(dimensions[2]); mix(maximum); mix(lights.length)
  for (const light of lights) {
    for (const value of light.positionRange) mix(value)
    for (const value of light.colorDecay) mix(value)
    mix(light.priority ?? 0)
  }
  return (hash >>> 0).toString(16)
}

function nowAdvanced(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }

function projectBounds(bounds: Box3, matrix: Matrix4, width: number, height: number): ProjectedBounds {
  const min = bounds.min, max = bounds.max
  const points = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [min.x, max.y, min.z], [max.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [min.x, max.y, max.z], [max.x, max.y, max.z],
  ] as const
  const elements = matrix.elements
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, nearDepth = 1, farDepth = 0, valid = false
  for (const point of points) {
    const x = point[0], y = point[1], z = point[2]
    const clipX = (elements[0] ?? 0) * x + (elements[4] ?? 0) * y + (elements[8] ?? 0) * z + (elements[12] ?? 0)
    const clipY = (elements[1] ?? 0) * x + (elements[5] ?? 0) * y + (elements[9] ?? 0) * z + (elements[13] ?? 0)
    const clipZ = (elements[2] ?? 0) * x + (elements[6] ?? 0) * y + (elements[10] ?? 0) * z + (elements[14] ?? 0)
    const clipW = (elements[3] ?? 0) * x + (elements[7] ?? 0) * y + (elements[11] ?? 0) * z + (elements[15] ?? 0)
    if (clipW <= 0.00001) continue
    const ndcX = clipX / clipW
    const ndcY = clipY / clipW
    const depth = clipZ / clipW * 0.5 + 0.5
    const pixelX = (ndcX * 0.5 + 0.5) * (width - 1)
    const pixelY = (ndcY * 0.5 + 0.5) * (height - 1)
    minX = Math.min(minX, pixelX); maxX = Math.max(maxX, pixelX)
    minY = Math.min(minY, pixelY); maxY = Math.max(maxY, pixelY)
    nearDepth = Math.min(nearDepth, depth); farDepth = Math.max(farDepth, depth)
    valid = true
  }
  return { minX: Math.max(0, minX), minY: Math.max(0, minY), maxX: Math.min(width - 1, maxX), maxY: Math.min(height - 1, maxY), nearDepth, farDepth, valid: valid && maxX >= 0 && maxY >= 0 && minX < width && minY < height }
}
function clampIndex(value: number, count: number): number { return Math.max(0, Math.min(count - 1, value)) }
function depthSlice(depth: number, near: number, far: number, slices: number): number {
  const normalized = Math.log(Math.max(near, depth) / near) / Math.log(far / near)
  return clampIndex(Math.floor(normalized * slices), slices)
}
