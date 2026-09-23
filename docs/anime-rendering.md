# Anime rendering

Sekai64 `StandardMaterial` supports two shading models:

```ts
new StandardMaterial({
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
    outlinePower: 4.5,
  },
})
```

The toon path works in both WebGL2 and WebGPU and remains inside the existing standard-material pipeline, so it retains textures, point and directional lights, shadow maps, alpha handling, batching, and instancing.

## Current outline behavior

`outlineStrength` controls view-dependent silhouette darkening in the material shader. It is lightweight and batching-safe. It is not yet a geometry-expanded inverted-hull outline or a screen-space edge pass, so it does not draw internal object boundaries.
