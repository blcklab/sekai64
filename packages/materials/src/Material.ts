import { ManagedResource } from '@sekai64-internal/core'

export type MaterialSide = 'front' | 'back' | 'double'

export interface MaterialOptions {
  label?: string
  transparent?: boolean
  /** Backward-compatible alias for side: 'double'. */
  doubleSided?: boolean
  side?: MaterialSide
  depthWrite?: boolean
  /** Declares an unsupported wireframe request so renderers can diagnose it honestly. */
  wireframe?: boolean
  /** Stable transparent ordering bias; larger values render later. */
  sortBias?: number
}

export abstract class Material extends ManagedResource {
  transparent: boolean
  side: MaterialSide
  depthWrite: boolean
  wireframe: boolean
  sortBias: number
  version = 0

  protected constructor(options: MaterialOptions = {}) {
    super(options.label)
    this.transparent = options.transparent ?? false
    this.side = options.side ?? (options.doubleSided ? 'double' : 'front')
    this.depthWrite = options.depthWrite ?? !this.transparent
    this.wireframe = options.wireframe ?? false
    this.sortBias = Number.isFinite(options.sortBias) ? options.sortBias as number : 0
  }

  get doubleSided(): boolean { return this.side === 'double' }
  set doubleSided(value: boolean) { this.side = value ? 'double' : 'front'; this.markChanged() }

  setSide(side: MaterialSide): this { this.assertAlive(); this.side = side; this.markChanged(); return this }
  setWireframe(wireframe: boolean): this { this.assertAlive(); this.wireframe = wireframe; this.markChanged(); return this }
  setSortBias(sortBias: number): this { this.assertAlive(); this.sortBias = Number.isFinite(sortBias) ? sortBias : 0; this.markChanged(); return this }
  markChanged(): void { this.assertAlive(); this.version += 1 }
  protected release(): void { this.version += 1 }
}
