# Sekai64 docs

Start with the [installation and quick start](../README.md#quick-start), then pick the guide for what you're building. Examples use the public `@blcklab/sekai64` package and its optional subpaths.

## Models and materials

- [Load glTF, GLB, and VRM assets](assets-gltf.md) — loading, textures, Draco, and cleanup.
- [Play animations](animation-and-animated-gltf.md) — connect the animation module and play a model's clips.
- [Render anime characters](anime-rendering.md) — toon shading, VRM materials, and outlines.
- [Use dynamic textures](dynamic-textures.md) — put a canvas or changing image on a material.

## Scenes and interaction

- [Coordinate system](coordinate-system.md) — axes, angles, transforms, and camera depth.
- [Build explorable worlds](explorable-worlds.md) — buildings, collision, and first-person controls.
- [Add WebXR](xr.md) — sessions, player rigs, controller input, and AR placement.
- [Environment, large scenes, and recovery](environment-large-scene-recovery.md) — HDR lighting, spatial queries, and device loss.

## Integration and troubleshooting

- [Install renderer modules](modular-renderer-modules.md) — setup, dependencies, and disposal.
- [Write a renderer adapter](renderer-adapters.md) — map your app's objects to Sekai64 and share resources safely.
- [Streaming and decoders](streaming-decoders.md) — schedule asset work and supply external codecs.
- [Performance](performance.md) — what to measure and how to compare results.
- [Security](security.md) — input validation and the policies your app supplies.
- [Compatibility](compatibility.md) — package boundaries and release-candidate stability.
- [Known limitations](limitations.md) — gaps to check before committing to a feature.

Release history lives in the [changelog](../CHANGELOG.md).
