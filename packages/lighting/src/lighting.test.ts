import { describe, expect, it } from 'vitest'
import { Vector3 } from '@sekai64-internal/math'
import { Scene } from '@sekai64-internal/scene'
import { PointLight, collectSceneLights } from './Light.js'

describe('point light selection', () => {
  it('selects the nearest bounded point lights deterministically', () => {
    const scene = new Scene()
    const far = new PointLight({ id: 'far' }); far.position.x = 10
    const near = new PointLight({ id: 'near' }); near.position.x = 1
    const middle = new PointLight({ id: 'middle' }); middle.position.x = 2
    scene.add(far, near, middle); scene.updateWorldMatrix()
    const summary = collectSceneLights(scene, 2, new Vector3())
    expect(summary.pointCount).toBe(3)
    expect(summary.selectedPointCount).toBe(2)
    expect(summary.pointLights.map(item => item.source.id)).toEqual(['near', 'middle'])
  })
})
