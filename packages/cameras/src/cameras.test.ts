import { describe, expect, it } from 'vitest'
import { Vector3 } from '@sekai64-internal/math'
import { Node } from '@sekai64-internal/scene'
import { PerspectiveCamera } from './index.js'

describe('PerspectiveCamera', () => {
  it('updates auto aspect from the viewport', () => {
    const camera = new PerspectiveCamera()
    camera.updateViewport(1920, 1080)
    camera.updateMatrices()
    expect(camera.aspect).toBeCloseTo(16 / 9)
    expect(camera.projectionMatrix.elements[0]).toBeGreaterThan(0)
  })

  it('keeps local -Z aimed at a lookAt target around the full orbit', () => {
    for (const position of [
      [0, 0, 5], [5, 0, 0], [0, 0, -5], [-5, 0, 0], [3, 2, 4], [-3, 2, -4],
    ] as const) {
      const camera = new PerspectiveCamera()
      camera.position.fromArray(position)
      camera.lookAt([0, 0, 0])
      const actual = camera.getWorldDirection(new Vector3())
      const expected = new Vector3().subVectors(new Vector3(), camera.position).normalize()
      expect(actual.distanceTo(expected)).toBeLessThan(1e-5)
      expect(camera.rotation.order).toBe('YXZ')
      camera.dispose()
    }
  })

  it('looks at a world target from a parented camera rig', () => {
    const rig = new Node()
    rig.position.set(10, 0, 2)
    rig.rotation.set(0, Math.PI / 3, 0)
    const camera = new PerspectiveCamera()
    rig.add(camera)
    camera.position.set(0, 2, 5)
    const target = new Vector3(10, 1, 2)
    camera.lookAt(target)
    camera.updateWorldFromRoot()
    const worldPosition = new Vector3().setFromMatrixPosition(camera.worldMatrix)
    const expected = target.clone().sub(worldPosition).normalize()
    expect(camera.getWorldDirection(new Vector3()).distanceTo(expected)).toBeLessThan(1e-4)
    rig.dispose()
  })
})
