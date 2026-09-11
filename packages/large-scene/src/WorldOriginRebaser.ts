import { Vector3 } from '@sekai64-internal/math'
import type { Node } from '@sekai64-internal/scene'

export interface WorldOriginRebaserOptions {
  threshold?: number
  gridSize?: number
}

export interface WorldOriginShift {
  shifted: boolean
  offset: readonly [number, number, number]
  accumulatedOrigin: readonly [number, number, number]
}

/** Keeps local renderer coordinates precise while preserving an accumulated world origin. */
export class WorldOriginRebaser {
  readonly accumulatedOrigin = new Vector3()
  readonly threshold: number
  readonly gridSize: number
  shifts = 0

  constructor(options: WorldOriginRebaserOptions = {}) {
    this.threshold = Math.max(1, options.threshold ?? 10_000)
    this.gridSize = Math.max(1, options.gridSize ?? 1_000)
  }

  update(reference: Vector3, roots: readonly Node[]): WorldOriginShift {
    if (reference.length() < this.threshold) return this.result(false, 0, 0, 0)
    const x = Math.round(reference.x / this.gridSize) * this.gridSize
    const y = Math.round(reference.y / this.gridSize) * this.gridSize
    const z = Math.round(reference.z / this.gridSize) * this.gridSize
    if (x === 0 && y === 0 && z === 0) return this.result(false, 0, 0, 0)
    for (const root of roots) root.position.set(root.position.x - x, root.position.y - y, root.position.z - z)
    this.accumulatedOrigin.add(new Vector3(x, y, z))
    this.shifts += 1
    return this.result(true, x, y, z)
  }

  toGlobal(local: Vector3, target = new Vector3()): Vector3 { return target.copy(local).add(this.accumulatedOrigin) }
  toLocal(global: Vector3, target = new Vector3()): Vector3 { return target.copy(global).sub(this.accumulatedOrigin) }
  reset(): void { this.accumulatedOrigin.set(0, 0, 0); this.shifts = 0 }

  private result(shifted: boolean, x: number, y: number, z: number): WorldOriginShift {
    return Object.freeze({ shifted, offset: [x, y, z] as const, accumulatedOrigin: this.accumulatedOrigin.toArray() as [number, number, number] })
  }
}
