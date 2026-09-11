import { Box3, Vector3 } from '@sekai64-internal/math'

export interface VisibilityRegion {
  id: string
  bounds: Box3
  loadDistance: number
  unloadDistance: number
  priority: number
  metadata?: Readonly<Record<string, unknown>>
}

export interface VisibilityRegionState {
  region: VisibilityRegion
  distance: number
  desiredResident: boolean
}

/** Deterministic region selection shared by render visibility and asset streaming. */
export class VisibilityRegionIndex {
  private readonly regions = new Map<string, VisibilityRegion>()

  add(region: Omit<VisibilityRegion, 'loadDistance' | 'unloadDistance' | 'priority'> & Partial<Pick<VisibilityRegion, 'loadDistance' | 'unloadDistance' | 'priority'>>): this {
    if (!region.id) throw new Error('Visibility region id is required.')
    const loadDistance = Math.max(0, region.loadDistance ?? 64)
    const unloadDistance = Math.max(loadDistance, region.unloadDistance ?? loadDistance * 1.25)
    this.regions.set(region.id, { ...region, loadDistance, unloadDistance, priority: region.priority ?? 0 })
    return this
  }

  remove(id: string): boolean { return this.regions.delete(id) }
  get(id: string): VisibilityRegion | undefined { return this.regions.get(id) }

  evaluate(reference: Vector3, resident: ReadonlySet<string> = new Set()): readonly VisibilityRegionState[] {
    return [...this.regions.values()].map(region => {
      const distance = region.bounds.distanceToPoint(reference)
      const threshold = resident.has(region.id) ? region.unloadDistance : region.loadDistance
      return { region, distance, desiredResident: distance <= threshold }
    }).sort((a, b) => Number(b.desiredResident) - Number(a.desiredResident) || b.region.priority - a.region.priority || a.distance - b.distance || a.region.id.localeCompare(b.region.id))
  }

  queryPoint(reference: Vector3): readonly VisibilityRegion[] {
    return [...this.regions.values()].filter(region => region.bounds.containsPoint(reference)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  }

  clear(): void { this.regions.clear() }
  get size(): number { return this.regions.size }
}
