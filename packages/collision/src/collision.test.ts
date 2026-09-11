import { describe, expect, it } from 'vitest'
import { Vector3 } from '@sekai64-internal/math'
import { CapsuleCharacterController } from './CapsuleCharacterController.js'
import { CollisionWorld } from './CollisionWorld.js'

describe('CapsuleCharacterController', () => {
  it('grounds on floors and does not tunnel through a wall', () => {
    const world = new CollisionWorld(2)
    world.addBox({ id: 'floor', min: [-10, -0.2, -10], max: [10, 0, 10] })
    world.addBox({ id: 'wall', min: [0.9, 0, -1], max: [1.2, 3, 1] })
    const controller = new CapsuleCharacterController({ world, height: 1.7, radius: 0.3 })
    let position = controller.move(new Vector3(0, 1.7, 0), new Vector3(), 1 / 60)
    expect(controller.grounded).toBe(true)
    position = controller.move(position, new Vector3(2, 0, 0), 1 / 60)
    expect(position.x).toBeLessThanOrEqual(0.61)
  })
})
