# WebXR

Sekai64's low-level WebXR implementation is isolated in `@blcklab/sekai64/xr`. Applications that do not import this subpath do not include XR session code.

Sekai64 owns native session, pose, view, framebuffer, and input handling. A higher-level world runtime such as Anyo remains responsible for collision, locomotion rules, rooms, portals, actions, and persistent world state.

## Current backend

The `0.7.0-rc.1` XR presentation path is WebGL2 through `XRWebGLLayer`. Create the engine with `renderer: 'webgl2'` before requesting an immersive session.

WebGPU remains available for ordinary rendering, but WebGPU XR presentation is not claimed by this release candidate.

## Session lifecycle

```ts
import { createEngine } from '@blcklab/sekai64'
import { WebGL2Renderer } from '@blcklab/sekai64/renderers/webgl2'
import {
  XRSessionManager,
  XRWebGLLayerBridge,
} from '@blcklab/sekai64/xr'

const engine = await createEngine({
  canvas,
  renderer: 'webgl2',
  antialias: true,
})

if (!(engine.renderer instanceof WebGL2Renderer)) {
  throw new Error('WebXR requires the WebGL2 renderer in this release.')
}

const xr = new XRSessionManager()
const layer = new XRWebGLLayerBridge(engine.renderer)

enterButton.addEventListener('click', async () => {
  const session = await xr.requestSession('immersive-vr', {
    referenceSpace: 'local-floor',
  })
  await layer.initialize(session, {
    antialias: true,
    depthNear: 0.05,
    depthFar: 100,
  })
  xr.start(state => layer.render(scene, state))
})
```

`XRSessionManager.state` uses an explicit state machine:

```text
idle
checking-support
entering
active
exiting
failed
disposed
```

Session entry is atomic. If reference-space initialization fails, Sekai64 ends the partial session and leaves no active session behind.

## Reference spaces

Immersive VR defaults to `local-floor`. When that space is unavailable, the manager can fall back to `local`. A `bounded-floor` request may fall back through `local-floor` and `local` unless the browser rejects the session because the feature was explicitly required.

The actual selected type is available as:

```ts
xr.referenceSpaceType
```

Do not infer bounded-floor support before a session successfully provides it.

## Player rig

The manager exposes a virtual player rig:

```ts
xr.setPlayerRigTransform({
  position: [4, 0, -8],
  yaw: Math.PI / 2,
})
```

Final viewer and controller transforms are computed as:

```text
player rig × native WebXR pose
```

This allows a host runtime to implement teleportation and turning while preserving physical room-scale movement.

## Viewer and input snapshots

Every frame provides renderer-neutral snapshots:

```ts
xr.start(state => {
  console.log(state.viewer)
  console.log(state.inputs)
})
```

Input snapshots include:

- Stable session-local input ID
- Handedness
- Target-ray mode
- Input profiles
- World-space target ray
- Optional grip pose
- Standardized WebXR gamepad button semantics
- Axes
- Haptics availability
- Optional native hand capability marker

Button semantics follow the WebXR gamepad layout:

```text
0 select trigger
1 squeeze
2 touchpad
3 thumbstick
4 primary
5 secondary
```

Sekai64 reports poses and controls. Higher-level action mapping remains the responsibility of the host runtime.

## Frame scheduling

`start()` is idempotent and schedules only one `XRSession.requestAnimationFrame()` chain. The next frame is scheduled in a `finally` path even when a callback or renderer throws. `stop()` cancels the current chain without ending the session.

A host runtime must not run a second desktop render loop at the same time. Anyo's Sekai64 adapter handles this transfer through its renderer frame driver.

## Tracking and lifecycle events

The manager reports:

- `statechange`
- `sessionstart`
- `sessionend`
- `inputsourceschange`
- `referencespacereset`
- `trackinglost`
- `trackingrestored`
- `frame`
- `error`

Browser-initiated session termination cleans the session, hit-test source, input snapshots, viewer pose, and frame callback.

## AR placement

Request the `hit-test` feature, call `enableHitTesting()`, and use `getPlacementMatrix()` or `getPlacementPosition()` during a frame. `createAnchor()` works only when the browser and hit-test result expose anchor support.

AR support remains low-level and is not part of Anyo's first VR-focused release candidate.

## Security

Immersive WebXR normally requires HTTPS or localhost and an explicit user gesture. Sekai64 rejects entry in an explicitly insecure context, reports unsupported modes, and does not record or transmit poses.

## Disposal

Prefer asynchronous disposal when coordinating application shutdown:

```ts
await xr.disposeAsync()
layer.dispose()
engine.dispose()
```

The synchronous `dispose()` entry remains available for ordinary resource-owner interfaces and starts the same cleanup process.
