# Environment, large scenes, and recovery

These optional modules handle HDR lighting, spatial queries, and renderer recovery. Install only the ones your scene needs; see [module setup](modular-renderer-modules.md).

## HDR environments

Use `@blcklab/sekai64/environment` to decode Radiance HDR files and attach an environment to the renderer.

```ts
import { createEngine } from '@blcklab/sekai64'
import {
  createEnvironmentRendererModule,
  decodeRadianceHdr
} from '@blcklab/sekai64/environment'

const environment = createEnvironmentRendererModule()
const engine = await createEngine({ canvas: '#app', modules: [environment] })

const response = await fetch('/environments/studio.hdr')
if (!response.ok) throw new Error(`HDR request failed: ${response.status}`)

const hdr = decodeRadianceHdr(await response.arrayBuffer(), { id: 'studio' })
environment.setEnvironment(hdr, { intensity: 1, background: true })
```

The module passes linear HDR pixels to the renderer and adds an ambient probe. The renderers use diffuse irradiance and prefiltered specular lighting. `background: true` sets the clear color to the environment's average color; it does not draw a panoramic sky.

`EnvironmentResource.toLdr()` produces tone-mapped pixels when you need an LDR image. Your app owns the resource: detach it with `environment.setEnvironment(undefined)`, then call `hdr.dispose()` when done.

## Large scenes

`@blcklab/sekai64/large-scene` provides tools for reducing work as a world grows:

- `SpatialMeshIndex` narrows mesh candidates for ray, box, frustum, and nearby-point queries.
- `ShadowBudgetManager` chooses lights and resolutions within a budget. Shadow rendering is handled by the backend.
- `VisibilityRegionIndex` chooses regions to keep loaded based on distance and priority.
- `WorldOriginRebaser` shifts scene roots near the origin to preserve coordinate precision and tracks the accumulated world offset.

For picking, query the spatial index first, then run exact triangle tests on the candidates. See [renderer adapters](renderer-adapters.md#picking) and [streaming](streaming-decoders.md) for related integration guidance.

## Recovery

`@blcklab/sekai64/recovery` coordinates renderer recovery and runs registered resource restorers afterward. WebGPU can request a replacement adapter and device; WebGL2 coordinates browser context restoration. GPU resources are uploaded again as needed from retained CPU data.

Register a restorer for resources that need app-specific rebuilding. Keep enough source data to restore them, or retain a way to fetch it again. Recovery cannot reconstruct data your app has discarded.

The module reports `progress`, `recovered`, and `failed` events and retries up to `maxAttempts` (default: `2`). If recovery still fails, your app needs to reload or replace the scene. Test device and context loss on your target browsers before relying on this path.
