# Sekai64 Dynamic Texture

Renderer-neutral dynamic image resources assembled into `@blcklab/sekai64/dynamic-texture`.

```ts
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'

const capability = createDynamicTextureCapability(renderer, {
  maxDimension: 2048,
  diagnostics: diagnostic => console.warn(diagnostic)
})

const frame = capability.create({
  source: canvas,
  label: 'application-frame',
  minFilter: 'nearest',
  magFilter: 'nearest'
})

frame.update(canvas)
frame.resize(320, 288)
frame.dispose()
```

The module owns CPU-side texture state only. WebGL2 and WebGPU renderers own backend allocations and uploads. Same-size updates reuse GPU storage; resize or format changes reallocate. No loop, Anyo semantic, application runtime, or required renderer method is added.

Generated mipmaps are supported on both WebGL2 and WebGPU. WebGPU regenerates the mip chain after same-size dynamic updates, so oblique UI/text surfaces can use trilinear + anisotropic sampling without stale lower levels.
