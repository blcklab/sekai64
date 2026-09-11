import { describe, expect, it } from 'vitest'
import { Scene } from '@sekai64-internal/scene'
import { createBuilding } from './Building.js'

describe('createBuilding', () => {
  it('segments a wall around a doorway and tags collision geometry', () => {
    const scene = new Scene()
    scene.add(createBuilding({ width: 12, depth: 14, openings: [{ type: 'door', wall: 'front', width: 2, height: 2.4 }] }))
    scene.updateWorldMatrix()
    expect(scene.findByTag('wall').length).toBeGreaterThanOrEqual(4)
    expect(scene.findByTag('collision').length).toBeGreaterThan(4)
    scene.dispose()
  })
})
