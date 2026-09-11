# Dynamic textures

Use a dynamic texture to display a canvas, emulator frame, or changing image on a material. Call `update()` when the source changes; Sekai64 uploads it on the next render.

## Put a canvas on a material

This example assumes you have an engine and a canvas named `emulatorCanvas`.

```ts
import { StandardMaterial } from '@blcklab/sekai64'
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'

const surfaces = createDynamicTextureCapability(engine.renderer, {
  maxDimension: 2048,
  diagnostics: diagnostic => console.warn(diagnostic)
})

const frame = surfaces.create({
  source: emulatorCanvas,
  label: 'gameboy-frame',
  colorSpace: 'srgb',
  minFilter: 'nearest',
  magFilter: 'nearest',
  mipmaps: 'none'
})

const screenMaterial = new StandardMaterial({
  baseColorTexture: frame.texture,
  emissiveTexture: frame.texture,
  emissive: '#ffffff'
})

// Call after drawing a new frame, even when reusing the same canvas.
frame.update(emulatorCanvas)
```

Assign `screenMaterial` to your screen mesh. `frame.texture` is a regular Sekai64 `Texture`, so it works with existing material texture slots.

Sources include `ImageBitmap`, `ImageData`, `HTMLCanvasElement`, `OffscreenCanvas`, and `HTMLImageElement`, plus other image sources accepted by `Texture`.

## Updates and resizing

Your app controls update timing. Pause updates for hidden surfaces and set a frame budget if you have many screens. Sekai64 does not start a separate loop or detect changes to the source.

Multiple updates before a render leave only the latest texture version to upload. Both backends reuse GPU storage while dimensions and format stay compatible; a size or format change reallocates it.

```ts
// Replace the source with a blank frame. This does not scale the old image.
frame.resize(320, 288)

// Release the texture when the screen no longer uses it.
frame.dispose()
```

The texture retains its CPU source. WebGL2 can rebuild it after context restoration; after WebGPU device loss, a replacement renderer can upload the retained texture again. See [recovery](environment-large-scene-recovery.md#recovery).

## Mipmaps and size limits

WebGL2 supports `mipmaps: 'generate'`. The dynamic-texture API currently downgrades that option to `'none'` on WebGPU and reports `SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE`.

Width and height must be positive integers. Each dimension must fit within the renderer's texture limit and `maxDimension`, which defaults to `8192`.

| Diagnostic | Meaning |
| --- | --- |
| `SEKAI64_DYNAMIC_TEXTURE_INVALID_SIZE` | The source dimensions are not positive integers. |
| `SEKAI64_DYNAMIC_TEXTURE_SIZE_LIMIT` | A dimension exceeds the allowed maximum. |
| `SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE` | WebGPU will use only the base mip level for this dynamic texture. |
