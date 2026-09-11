import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { Vector3 } from '@sekai64-internal/math'
import { FirstPersonControls } from './FirstPersonControls.js'
import { InputState } from './InputState.js'
import { OrbitControls } from './OrbitControls.js'

describe('FirstPersonControls', () => {
  it('moves forward from an input snapshot state', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 1.7, 2)
    const input = new InputState({})
    input.keys.add('KeyW')
    const controls = new FirstPersonControls({ camera, input, movementSpeed: 4 })
    controls.update(0.25)
    expect(camera.position.z).toBeLessThan(2)
    expect(camera.rotation.order).toBe('YXZ')
    controls.dispose(); input.dispose(); camera.dispose()
  })
})

describe('OrbitControls', () => {
  it('maps equal pointer deltas to equal orbit steps instead of accumulating acceleration', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 5)
    const input = new InputState({})
    const controls = new OrbitControls({ camera, input, target: [0, 0, 0], rotateSpeed: 0.003, damping: 0.2 })
    input.buttons.add(0)
    const azimuths: number[] = []
    for (let frame = 0; frame < 4; frame += 1) {
      input.pointerDelta.set(10, 0)
      controls.update(1 / 60)
      azimuths.push(Math.atan2(camera.position.x, camera.position.z))
      const expected = new Vector3().subVectors(controls.target, camera.position).normalize()
      expect(camera.getWorldDirection(new Vector3()).distanceTo(expected)).toBeLessThan(1e-5)
    }
    for (let index = 1; index < azimuths.length; index += 1) {
      expect((azimuths[index] ?? 0) - (azimuths[index - 1] ?? 0)).toBeCloseTo(-0.03, 6)
    }
    controls.dispose(); input.dispose(); camera.dispose()
  })



  it('focuses a new target at a deterministic distance without changing view direction', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(3, 2, 5)
    const input = new InputState({})
    const controls = new OrbitControls({ camera, input, target: [0, 0, 0], minDistance: 0.1, maxDistance: 100 })
    const beforeDirection = camera.position.clone().sub(controls.target).normalize()
    controls.focus([0, 1.7, 0], 1.25)
    const afterDirection = camera.position.clone().sub(controls.target).normalize()
    expect(controls.target.equals(new Vector3(0, 1.7, 0))).toBe(true)
    expect(controls.getDistance()).toBeCloseTo(1.25, 6)
    expect(afterDirection.distanceTo(beforeDirection)).toBeLessThan(1e-6)
    const expectedLook = new Vector3().subVectors(controls.target, camera.position).normalize()
    expect(camera.getWorldDirection(new Vector3()).distanceTo(expectedLook)).toBeLessThan(1e-5)
    controls.setDistance(0.6)
    expect(controls.getDistance()).toBeCloseTo(0.6, 6)
    controls.dispose(); input.dispose(); camera.dispose()
  })
  it('clears old inertia when resynced from a fitted or teleported camera', () => {
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 5)
    const input = new InputState({})
    const controls = new OrbitControls({ camera, input, target: [0, 0, 0] })
    input.buttons.add(0)
    input.pointerDelta.set(80, 0)
    controls.update(1 / 60)
    input.buttons.clear()
    camera.position.set(0, 2, 8)
    controls.syncFromCamera()
    const before = camera.position.clone()
    controls.update(1 / 60)
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-6)
    controls.dispose(); input.dispose(); camera.dispose()
  })
})
