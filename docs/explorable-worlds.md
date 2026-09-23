# Explorable Worlds

Sekai64 keeps exploration systems optional. A typical building application combines four optional modules from the same installation: buildings, collision, controls, and interaction.

## Recommended construction order

1. Add the generated building and interactive objects to a scene.
2. Call `scene.updateWorldMatrix()`.
3. Build a `CollisionWorld` from meshes tagged `collision`.
4. Create a `CapsuleCharacterController`.
5. Pass the character controller to `FirstPersonControls`.
6. Create an `InteractionManager` for selection and clicks.

```ts
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
```

The v0.4 collision system is intentionally architectural. Full rigid-body physics, impulses, joints, and dynamic stacks should remain adapters rather than core dependencies.
