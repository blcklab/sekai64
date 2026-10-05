# @blcklab/sekai64

A modular WebGPU/WebGL2 TypeScript renderer for interactive 3D applications, glTF/GLB content, VRM characters, large scenes, media surfaces, and optional WebXR.

> `0.8.0-rc.39` is a release candidate and is published under the `next` npm dist-tag.

## Installation

```bash
npm install @blcklab/sekai64@next
```

The public package has zero third-party runtime dependencies. Optional Draco, Meshopt, and KTX2/Basis codec bridges are separate host-injected packages.

## Quick start

```ts
import { createEngine, PerspectiveCamera, Scene } from '@blcklab/sekai64'
import { loadModel } from '@blcklab/sekai64/gltf'

const engine = await createEngine({ canvas: '#app', renderer: 'auto' })
const scene = new Scene()
const camera = new PerspectiveCamera()

const model = await loadModel('/models/product.glb')
scene.add(model)

// Dispose model-owned geometry, materials and shared asset references.
model.dispose()
```

## Capabilities

- WebGPU rendering with WebGL2 fallback
- Generic material UV scale/offset/rotation plus clamp/repeat/mirror-repeat wrapping with WebGL2/WebGPU parity
- glTF/GLB loading, including binary VRM containers
- PBR materials, MToon/VRM material support, textures, lights, cameras, and picking
- Optional animation, environment, streaming, recovery, large-scene, dynamic-texture, and WebXR modules
- Generic packed `PointField` scene primitive with world-space or translation-invariant directional rendering in WebGL2/WebGPU
- Skeleton animation, morph targets, clips, mixers, crossfades, and markers
- HDR environment lighting and renderer quality controls
- Orbit and first-person controls
- Explicit resource ownership and disposal

## Character rendering

```ts
import { CHARACTER_VISUAL_PRESET } from '@blcklab/sekai64/renderer'

renderer.setColorManagement?.(CHARACTER_VISUAL_PRESET.colorManagement)
renderer.setEnvironmentLighting?.(CHARACTER_VISUAL_PRESET.environmentLighting)
renderer.setShadowOptions?.(CHARACTER_VISUAL_PRESET.shadows)
renderer.setImageQuality?.(CHARACTER_VISUAL_PRESET.imageQuality)
if (CHARACTER_VISUAL_PRESET.postProcessing) {
  renderer.setPostProcessing?.(CHARACTER_VISUAL_PRESET.postProcessing)
}
```

## Camera controls

```ts
import { OrbitControls } from '@blcklab/sekai64/controls'

camera.position.set(3, 2, 5)
camera.lookAt([0, 1, 0])

const controls = new OrbitControls({
  camera,
  target: [0, 1, 0],
  eventTarget: canvas,
})
```

## Package entry points

Sekai64 exposes focused subpaths such as `gltf`, `animation`, `controls`, `environment`, `large-scene`, `recovery`, `postprocessing`, `xr`, and renderer-specific entries. See the [documentation index](docs/README.md).

## Compatibility and limitations

See [Compatibility](docs/compatibility.md) and [Limitations](docs/limitations.md) before selecting optional features for production applications.

## License

MIT

## Procedural cloud authoring (rc.52 freeze)

Sekai64 exposes one generic dynamic-cloud renderer state. Cloud identity and art direction belong to the host/world, not to renderer-specific cloud systems. In addition to coverage, density, scale, seed, offset and evolution, worlds may author macro/detail scale, bounded detail breakup, edge softness, warp, horizon presence/softness, lighting response, cloud colors, and an independent detail-motion channel.

The renderer keeps deterministic seeded noise and WebGL2/WebGPU parity. Hosts should keep a session seed stable, drive macro `offset`/`evolution` for large cloud motion, and optionally drive `detailOffset`/`detailEvolution` more slowly or along a slightly different direction for organic breakup. Horizon visibility is a style input rather than a hard renderer fade.

The rc.52 contract closes the final projection-boundary gap: worlds may author `horizonExtension`, `horizonCompression`, and `horizonAtmosphericFade` so distant cloud banks can continue slightly beneath the mathematical horizon without exposing a horizontal cutoff. The continuation is still part of the background pass, so scene geometry renders normally in front and downward views fade the cloud underlap away.

The rc.52 contract is intended to be the cloud-feature freeze: future cloud looks and horizon profiles should be created by changing authored world/runtime values rather than modifying Sekai64.
