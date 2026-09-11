import type { Disposable } from '@sekai64-internal/core'
import { AssetTaskLease, AssetTaskScheduler, type AssetTaskContext, type AssetTaskPriority } from './AssetTaskScheduler.js'

export interface StreamingReferencePoint { x: number; y: number; z: number }

export interface StreamingRegion<T> {
  id: string
  center: readonly [number, number, number]
  radius?: number
  loadDistance: number
  unloadDistance?: number
  priority?: number
  estimatedBytes?: number
  load(context: AssetTaskContext): Promise<T>
  dispose?(value: T): void
}

export interface RegionStreamingStats {
  regions: number
  resident: number
  loading: number
  desired: number
  queued: number
  residentBytes: number
  loads: number
  unloads: number
}

/** Camera-prioritized region residency controller with load/unload hysteresis. */
export class RegionStreamingController<T> implements Disposable {
  disposed = false
  private readonly regions = new Map<string, StreamingRegion<T>>()
  private readonly resident = new Map<string, AssetTaskLease<T>>()
  private readonly loading = new Map<string, Promise<void>>()
  private loads = 0
  private unloads = 0

  constructor(readonly scheduler: AssetTaskScheduler) {}

  add(region: StreamingRegion<T>): this {
    if (!region.id) throw new Error('Streaming region id is required.')
    if (!(region.loadDistance >= 0)) throw new Error('Streaming region loadDistance must be non-negative.')
    const unloadDistance = Math.max(region.loadDistance, region.unloadDistance ?? region.loadDistance * 1.25)
    this.regions.set(region.id, { ...region, unloadDistance })
    return this
  }

  remove(id: string): boolean {
    this.unload(id)
    return this.regions.delete(id)
  }

  update(reference: StreamingReferencePoint): RegionStreamingStats {
    if (this.disposed) throw new Error('RegionStreamingController is disposed.')
    const evaluated = [...this.regions.values()].map(region => {
      const distance = regionDistance(region, reference)
      const threshold = this.resident.has(region.id) || this.loading.has(region.id)
        ? region.unloadDistance ?? region.loadDistance
        : region.loadDistance
      return { region, distance, desired: distance <= threshold }
    }).sort((a, b) => Number(b.desired) - Number(a.desired) || (b.region.priority ?? 0) - (a.region.priority ?? 0) || a.distance - b.distance || a.region.id.localeCompare(b.region.id))

    for (const item of evaluated) {
      const priority = normalizeRegionPriority(item.region.priority ?? 0, item.distance, item.region.loadDistance)
      if (item.desired) {
        this.scheduler.setPriority(item.region.id, priority)
        if (!this.resident.has(item.region.id) && !this.loading.has(item.region.id)) this.beginLoad(item.region, priority)
      } else if (this.resident.has(item.region.id)) this.unload(item.region.id)
    }

    return this.stats(evaluated.filter(item => item.desired).length)
  }

  async updateAndWait(reference: StreamingReferencePoint): Promise<RegionStreamingStats> {
    this.update(reference)
    await this.whenIdle()
    return this.stats([...this.regions.values()].filter(region => regionDistance(region, reference) <= (this.resident.has(region.id) ? region.unloadDistance ?? region.loadDistance : region.loadDistance)).length)
  }

  async whenIdle(): Promise<void> {
    while (this.loading.size > 0) await Promise.allSettled([...this.loading.values()])
  }

  get(id: string): T | undefined { return this.resident.get(id)?.value }
  has(id: string): boolean { return this.resident.has(id) }

  unload(id: string): void {
    const lease = this.resident.get(id)
    if (!lease) return
    lease.dispose()
    this.resident.delete(id)
    this.unloads += 1
  }

  stats(desired = 0): RegionStreamingStats {
    const scheduler = this.scheduler.stats
    return {
      regions: this.regions.size,
      resident: this.resident.size,
      loading: this.loading.size,
      desired,
      queued: scheduler.queued,
      residentBytes: scheduler.residentBytes,
      loads: this.loads,
      unloads: this.unloads,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const lease of this.resident.values()) lease.dispose()
    this.resident.clear()
    for (const id of this.loading.keys()) this.scheduler.cancel(id, new Error('Region streaming controller disposed.'))
    this.loading.clear()
    this.regions.clear()
  }

  private beginLoad(region: StreamingRegion<T>, priority: AssetTaskPriority): void {
    const promise = this.scheduler.schedule(region.id, region.load, {
      priority,
      estimatedBytes: region.estimatedBytes,
      ...(region.dispose ? { disposeValue: region.dispose } : {}),
    }).then(lease => {
      if (this.disposed || !this.regions.has(region.id)) { lease.dispose(); return }
      this.resident.get(region.id)?.dispose()
      this.resident.set(region.id, lease)
      this.loads += 1
    }).finally(() => { this.loading.delete(region.id) })
    this.loading.set(region.id, promise)
  }
}

function regionDistance(region: StreamingRegion<unknown>, reference: StreamingReferencePoint): number {
  const dx = region.center[0] - reference.x
  const dy = region.center[1] - reference.y
  const dz = region.center[2] - reference.z
  return Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - Math.max(0, region.radius ?? 0))
}

function normalizeRegionPriority(priority: number, distance: number, loadDistance: number): number {
  const proximity = 1 - Math.min(1, distance / Math.max(1, loadDistance))
  return priority * 1000 + proximity * 100
}
