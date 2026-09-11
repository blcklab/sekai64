# @blcklab/sekai64

A lightweight WebGPU/WebGL2 TypeScript renderer for JSON-first and compiled virtual worlds, textured glTF/GLB models, precise interaction, media surfaces, and optional WebXR.

```bash
npm install @blcklab/sekai64
```

Sekai64 renderer features are published as **one tree-shakable package** with **zero third-party runtime dependencies**. Optional Draco, Meshopt, and KTX2/Basis bridges are separate packages and contain no codec payload themselves.

```ts
import { createEngine, PerspectiveCamera, Scene } from '@blcklab/sekai64'
import { loadModel } from '@blcklab/sekai64/gltf'

const engine = await createEngine({ canvas: '#app', renderer: 'auto' })
const scene = new Scene()
const camera = new PerspectiveCamera()

const product = await loadModel('/models/product.glb', { signal })
scene.add(product)

// Releases model geometry, materials, shared textures, and loader assets.
product.dispose()
```

Highlights in `0.8.0-rc.33`:

- WebGPU sampler compatibility for glTF/VRM nearest and mixed filtering: anisotropy is automatically disabled only when the authored sampler is incompatible with WebGPU anisotropic filtering.
- Orbit focus targeting for inspect/viewer/third-person cameras via `focus()`, `getDistance()`, and `setDistance()`.

- Side-effect-free renderer modules with dependency ordering and awaited cleanup
- Optional animation, decoder, streaming, environment, large-scene, and recovery subpaths
- Skeleton palettes, morph targets, clips, mixers, markers, loop modes, seeking, and crossfades
- Explicit animated-glTF adapter with clear static-pose fallback behavior
- Native binary `.vrm` URL recognition through the glTF loader
- VRM 1.0 `VRMC_materials_mtoon` plus a compatibility bridge for legacy VRM 0.x `VRM.materialProperties` MToon assets
- Bounded spot lights on WebGL2 and WebGPU
- Linear HDR environment prefiltering with diffuse irradiance, GGX specular mips, split-sum BRDF integration, and ACES output tone mapping
- Correct WebGL2/WebGPU sRGB environment sampling and inverse-transpose normal transforms
- HDR Radiance decoding, shadow budgets, spatial picking candidates, and backend recovery orchestration
- Standalone host-injected Draco, Meshopt, and KTX2/Basis adapter packages with no bundled codecs
- Permanent core and optional-entry gzip budgets
- Zero third-party runtime dependencies in the public Sekai64 package



## Stable camera orientation

Interactive cameras should use Sekai64's camera view helpers instead of treating yaw/pitch as generic XYZ object rotation:

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

`Camera.lookAt()` and `Camera.setViewAngles()` use a camera-friendly YXZ orientation so the local `-Z` view direction remains stable through full horizontal rotation. `OrbitControls` maps drag distance directly to orbit angle and keeps only bounded release inertia, avoiding the old accumulating/accelerating drag behavior. `FirstPersonControls` uses the same view convention.

For a custom third-person/follow camera, update the position and then point it at the gameplay target each frame:

```ts
camera.position.lerp(desiredCameraPosition, smoothing)
camera.lookAt(characterFocusPoint)
```

For close-up product visualization, the renderer exports a high-fidelity preset:

```ts
import { PRODUCT_VISUAL_PRESET } from '@blcklab/sekai64/renderer'

renderer.setColorManagement?.(PRODUCT_VISUAL_PRESET.colorManagement)
renderer.setEnvironmentLighting?.(PRODUCT_VISUAL_PRESET.environmentLighting)
renderer.setShadowOptions?.(PRODUCT_VISUAL_PRESET.shadows)
renderer.setImageQuality?.(PRODUCT_VISUAL_PRESET.imageQuality)
```

For VRM/anime-character inspection, use the dedicated character preset:

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


```ts
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'

const frame = createDynamicTextureCapability(renderer).create({
  source: canvas,
  minFilter: 'nearest',
  magFilter: 'nearest'
})

frame.update(canvas)
frame.dispose()
```


```ts
import { loadModel } from '@blcklab/sekai64/gltf'

// A VRM file is a binary glTF container and is loaded through the same pipeline.
const avatarModel = await loadModel('/avatars/hero.vrm', { signal })
```

Dynamic textures do not create their own frame loop. Hosts and optional integration packages own dirty-state scheduling, visibility, input, and application lifecycle.

```ts
import { GLTF_LOADER_CAPABILITIES } from '@blcklab/sekai64/gltf'

console.log(GLTF_LOADER_CAPABILITIES)
```

Current limitations include CPU-based animation deformation, no bundled codecs, equirectangular rather than cubemap IBL storage, MToon animated UV parameters not yet evaluated at runtime, incomplete texture-slot coverage for other advanced glTF material extensions, no glTF cubic-spline animation, and pending physical device-loss validation.

Only the renderer workspaces are assembled into `@blcklab/sekai64`; internal workspaces remain private. The optional `@blcklab/sekai64-draco`, `@blcklab/sekai64-meshopt`, and `@blcklab/sekai64-ktx2` packages are explicit host-injected codec bridges.
