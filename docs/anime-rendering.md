# Anime and VRM rendering

Use `shadingModel: 'toon'` for stepped shading on a `StandardMaterial`. The toon shader works on both WebGL2 and WebGPU, with textures, lights, shadows, alpha modes, batching, and instancing.

```ts
import { StandardMaterial } from '@blcklab/sekai64'

const material = new StandardMaterial({
  baseColor: '#eeb7c5',
  shadingModel: 'toon',
  toon: {
    shadeSteps: 3,
    shadowColor: '#77749f',
    shadowStrength: 0.68,
    highlightColor: '#fff5cf',
    highlightStrength: 0.24,
    rimColor: '#ffe8f0',
    rimStrength: 0.24,
    rimPower: 2.2,
    outlineColor: '#29283b',
    outlineStrength: 0.78,
    outlinePower: 4.5
  }
})
```

Start with `shadeSteps` and the shadow color to set the look. Rim and outline settings add definition around the silhouette.

## VRM materials

The [glTF loader](assets-gltf.md) imports legacy VRM MToon materials and `VRMC_materials_mtoon`. These use the `mtoon` shading model, which has its own material controls.

For an initial lighting and quality setup, use `CHARACTER_VISUAL_PRESET` from `@blcklab/sekai64/renderer`. See the [character rendering example](../README.md#character-rendering).

## Outlines

The toon material's `outlineStrength` darkens silhouettes based on the viewing angle. It works with batching, but does not draw internal edges or expand the geometry.

MToon inverted-hull outlines and post-processing outlines are separate features. Changing `toon.outlineStrength` does not enable those passes. Check `engine.capabilities.features.outlines` and `invertedHullOutlines` before using them in an adapter.
