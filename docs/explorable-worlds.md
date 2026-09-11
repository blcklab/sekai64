# Explorable worlds

Combine `buildings`, `collision`, `controls`, and `interaction` to build a walkable scene. All four are optional subpaths of the same package.

## Build the scene, then add collision

Add your building and objects first, then update world matrices before collecting collision meshes. `CollisionWorld.addScene()` includes meshes tagged `collision` by default.

This example assumes an existing `engine`, `scene`, and `camera`.

```ts
import { createBuilding } from '@blcklab/sekai64/buildings'
import { CapsuleCharacterController, CollisionWorld } from '@blcklab/sekai64/collision'
import { FirstPersonControls } from '@blcklab/sekai64/controls'

const building = createBuilding({
  width: 20,
  depth: 30,
  floors: 2,
  floorHeight: 4,
  openings: [
    { type: 'door', wall: 'front', width: 2, height: 2.5 },
    { type: 'window', wall: 'left', position: 3, width: 2.4, height: 1.4, bottom: 1 }
  ]
})
scene.add(building)
scene.updateWorldMatrix()

const world = new CollisionWorld(4)
world.addScene(scene)

const character = new CapsuleCharacterController({
  world,
  radius: 0.32,
  height: 1.7,
  stepHeight: 0.28
})
const controls = new FirstPersonControls({ camera, target: window, collision: character })

engine.start(({ deltaTime }) => {
  controls.update(deltaTime)
  engine.render(scene, camera)
})
```

Place the camera at a valid starting position before creating the controls. Dispose the controls when leaving the scene to release their input listeners.

## Add selection and clicks

Use `InteractionManager` from `@blcklab/sekai64/interaction` to attach pointer handling to your canvas and register handlers for scene objects. See [picking guidance](renderer-adapters.md#picking) when choosing between bounds and triangle precision.

Collision here is intended for walking through architecture. For rigid bodies, impulses, joints, or stacked moving objects, integrate a physics engine.
