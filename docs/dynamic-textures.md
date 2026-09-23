# Dynamic textures — 0.7.0-rc.6

Sekai64 exposes an optional renderer-neutral dynamic-texture capability from:

```ts
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'
```

The capability owns a normal CPU-side Sekai64 `Texture`. Concrete WebGL2 and WebGPU renderers continue owning GPU allocations, uploads, restoration, and disposal. The required `Renderer` interface is unchanged.

## Basic use

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

// Call only when the application has a new frame.
frame.update(emulatorCanvas)

// Replaces the CPU source with a blank frame of the requested size.
frame.resize(320, 288)

frame.dispose()
```

A source may be an `ImageBitmap`, `ImageData`, `HTMLCanvasElement`, `OffscreenCanvas`, `HTMLImageElement`, or another image source already accepted by Sekai64 `Texture`.

## Upload behavior

- Repeated `update()` calls before a render retain only the latest observable texture version for that render.
- WebGL2 uses an in-place sub-upload when dimensions and format remain compatible.
- WebGPU reuses the existing GPU texture when dimensions and format remain compatible.
- Resizing or changing the backend texture format reallocates storage.
- WebGL2 context restoration lazily rebuilds the texture from retained CPU state.
- After WebGPU device loss, a host can create a replacement renderer and reuse the retained CPU-side texture resource.

Sekai64 does not start a frame loop for a dynamic texture. Scheduling, dirty-state tracking, visibility suspension, and update budgets belong to the host or an optional integration package.

## Mipmaps

WebGL2 may generate mipmaps when requested. WebGPU dynamic mipmap generation is not implemented in RC.6; requesting it is explicitly downgraded to the base level and emits `SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE`.

## Limits and diagnostics

Dimensions must be positive integers and may not exceed either the renderer's reported texture limit or the configured `maxDimension`.

Diagnostic codes:

- `SEKAI64_DYNAMIC_TEXTURE_INVALID_SIZE`
- `SEKAI64_DYNAMIC_TEXTURE_SIZE_LIMIT`
- `SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE`

## Architecture boundary

This module contains no Anyo, browser-application, emulator, UV-input, material-slot, or XR-interaction semantics. It is the generic GPU-resource foundation that those optional systems can build on.
