import type { Light } from '@sekai64-internal/lighting'
import type { Vector3 } from '@sekai64-internal/math'

export interface ShadowCandidate { light: Light & { castShadow?: boolean }; priority?: number; resolution?: number; distance?: number }
export interface ShadowBudget { maxLights: number; maxPixels: number; defaultResolution?: number }
export interface ShadowAllocation { light: Light; resolution: number; priority: number }

export class ShadowBudgetManager {
  constructor(readonly budget: ShadowBudget) {
    if (!Number.isInteger(budget.maxLights) || budget.maxLights < 0 || !Number.isFinite(budget.maxPixels) || budget.maxPixels < 0) throw new Error('Shadow budget values must be non-negative.')
  }
  allocate(candidates: readonly ShadowCandidate[]): readonly ShadowAllocation[] {
    let pixels = 0
    const selected: ShadowAllocation[] = []
    const ordered = candidates.filter(candidate => candidate.light.castShadow).map(candidate => ({ light: candidate.light, priority: candidate.priority ?? 0, resolution: Math.max(1, Math.floor(candidate.resolution ?? this.budget.defaultResolution ?? 1024)), distance: candidate.distance ?? 0 })).sort((a, b) => b.priority - a.priority || a.distance - b.distance || a.light.id.localeCompare(b.light.id))
    for (const candidate of ordered) {
      const cost = candidate.resolution * candidate.resolution
      if (selected.length >= this.budget.maxLights || pixels + cost > this.budget.maxPixels) continue
      selected.push({ light: candidate.light, resolution: candidate.resolution, priority: candidate.priority }); pixels += cost
    }
    return selected
  }
  static distance(lightPosition: Vector3, reference: Vector3): number { return lightPosition.distanceTo(reference) }
}
