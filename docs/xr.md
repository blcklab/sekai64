# WebXR

Import XR support from `@blcklab/sekai64/xr` and create the engine with `renderer: 'webgl2'`. XR presentation uses `XRWebGLLayer`; WebGPU XR presentation is not supported.

Sekai64 handles sessions, poses, views, framebuffers, and input. Your app handles locomotion, collision, actions, and world state.

## Enter a VR session

This example assumes a `canvas`, a `scene`, and an `enterButton`. Request the session from the button's click handler so entry follows a user gesture.

```ts
import { createEngine } from '@blcklab/sekai64'
import { WebGL2Renderer } from '@blcklab/sekai64/renderers/webgl2'
import { XRSessionManager, XRWebGLLayerBridge } from '@blcklab/sekai64/xr'

const engine = await createEngine({
  canvas,
  renderer: 'webgl2',
  antialias: true
})

if (!(engine.renderer instanceof WebGL2Renderer)) {
  throw new Error('WebXR requires the WebGL2 renderer.')
}

const xr = new XRSessionManager()
const layer = new XRWebGLLayerBridge(engine.renderer)

enterButton.addEventListener('click', async () => {
  try {
    const session = await xr.requestSession('immersive-vr', {
      referenceSpace: 'local-floor'
    })
    await layer.initialize(session, {
      antialias: true,
      depthNear: 0.05,
      depthFar: 100
    })
    engine.stop()
    xr.start(state => layer.render(scene, state))
  } catch (error) {
    console.error('Could not enter VR:', error)
    await xr.end().catch(console.error)
  }
})
```

`xr.state` is one of `idle`, `checking-support`, `entering`, `active`, `exiting`, `failed`, or `disposed`. If reference-space setup fails during entry, the manager ends the partial session.

## Reference spaces and movement

Immersive VR defaults to `local-floor`, with a fallback to `local`. A `bounded-floor` request can fall back through those spaces unless the browser rejects a feature marked as required. Read `xr.referenceSpaceType` after entry to see which space was selected.

Use the player rig to teleport or turn the player while preserving physical movement within their room:

```ts
xr.setPlayerRigTransform({
  position: [4, 0, -8],
  yaw: Math.PI / 2
})
```

The final viewer and controller transforms are `player rig × native WebXR pose`.

## Viewer and controller input

Each frame supplies `state.viewer` and `state.inputs`. Input snapshots include a stable ID within the session, handedness, target-ray mode, profiles, a world-space ray, optional grip pose, buttons, axes, haptics availability, and an optional native hand capability marker.

Button indices follow the WebXR gamepad layout:

| Index | Control |
| --- | --- |
| 0 | Select trigger |
| 1 | Squeeze |
| 2 | Touchpad |
| 3 | Thumbstick |
| 4 | Primary |
| 5 | Secondary |

Map these controls to your app's actions in the XR frame callback.

## Frame loop and events

`xr.start()` runs one `XRSession.requestAnimationFrame()` chain, even if called more than once. A thrown callback does not stop the next frame from being scheduled. `xr.stop()` stops that loop without ending the session; `await xr.end()` exits the session.

Stop the desktop render loop while XR is active, as shown above. Resume your desktop loop after `sessionend` if the app should return to a normal view.

The manager emits `statechange`, `sessionstart`, `sessionend`, `inputsourceschange`, `referencespacereset`, `trackinglost`, `trackingrestored`, `frame`, and `error`. Use tracking events to respond when poses become unavailable.

If the browser ends the session, the manager clears its hit-test source, input snapshots, viewer pose, and frame callback.

## AR placement

Request the `hit-test` feature, call `enableHitTesting()`, then read `getPlacementMatrix()` or `getPlacementPosition()` during a frame. `createAnchor()` requires support from both the browser and the hit-test result.

## Browser requirements and cleanup

Immersive sessions normally need HTTPS or localhost and a user gesture. Sekai64 rejects explicitly insecure contexts and reports unsupported modes. It does not record or transmit poses.

Await disposal when shutting down:

```ts
await xr.disposeAsync()
layer.dispose()
await engine.disposeAsync()
```

`xr.dispose()` starts the same cleanup without waiting for it.
