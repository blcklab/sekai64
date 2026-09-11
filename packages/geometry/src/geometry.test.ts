import { describe, expect, it } from 'vitest'
import { BoxGeometry, CylinderGeometry } from './index.js'

describe('Geometry primitives', () => {
  it('generates indexed box faces and bounds', () => {
    const geometry = new BoxGeometry({ width: 2, height: 4, depth: 6 })
    expect(geometry.triangleCount).toBe(12)
    expect(geometry.bounds.min.x).toBe(-1)
    expect(geometry.bounds.max.z).toBe(3)
  })

  it('generates capped cylinder geometry with stable bounds and UVs', () => {
    const geometry = new CylinderGeometry({ radiusTop: 0.25, radiusBottom: 0.5, height: 2, radialSegments: 12 })
    expect(geometry.bounds.min.y).toBe(-1)
    expect(geometry.bounds.max.y).toBe(1)
    expect(geometry.uvs?.length).toBe((geometry.positions.length / 3) * 2)
    expect(geometry.indices).toBeInstanceOf(Uint16Array)
    expect(geometry.triangleCount).toBeGreaterThanOrEqual(48)
  })

  it('supports cones and rejects invalid dimensions', () => {
    expect(() => new CylinderGeometry({ radiusTop: 0, radiusBottom: 0 })).toThrow(/positive radius/)
    expect(() => new CylinderGeometry({ radialSegments: 2 })).toThrow(/at least 3/)
    expect(new CylinderGeometry({ radiusTop: 0, radiusBottom: 1 }).bounds.max.y).toBe(0.5)
  })
})

import { BeveledBoxGeometry } from './BeveledBoxGeometry.js'

describe('BeveledBoxGeometry', () => {
  it('creates a bounded rounded cuboid with normalized normals', () => {
    const geometry = new BeveledBoxGeometry({ width: 4, height: 2, depth: 1, bevelRadius: 0.1, bevelSegments: 2 })
    expect(geometry.bounds.min.x).toBeCloseTo(-2)
    expect(geometry.bounds.max.x).toBeCloseTo(2)
    expect(geometry.triangleCount).toBeGreaterThan(12)
    for (let index = 0; index < (geometry.normals?.length ?? 0); index += 3) {
      const x = geometry.normals?.[index] ?? 0
      const y = geometry.normals?.[index + 1] ?? 0
      const z = geometry.normals?.[index + 2] ?? 0
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
    }
  })
})
