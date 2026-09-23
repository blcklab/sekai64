# Known limitations — 0.8.0-rc.25

## Animation

- Skeleton and morph deformation currently use dynamic CPU geometry followed by ordinary WebGL2/WebGPU buffer updates. Native vertex-shader skinning and GPU morph evaluation remain performance work.
- glTF animation supports translation, rotation, scale, and weight tracks with `LINEAR` and `STEP`. `CUBICSPLINE`, sparse accessors, additive layers, animation graphs, and root-motion policies are not included.
- Sekai64 mixers are renderer-level playback utilities. Gameplay state machines belong in the future optional Anyo Animation package.

## Compression and streaming

- Sekai64 contains no Draco, Meshopt, KTX2, Basis, or WASM codec. The optional adapter packages require a host-provided implementation.
- The worker pool is an execution contract; applications decide how worker files are created, hosted, secured, and versioned.
- Progressive mesh/texture refinement and HTTP range streaming are not yet implemented.

## Environment and lighting

- HDR environment lighting now preserves linear HDR values and uses diffuse irradiance plus GGX-prefiltered specular levels with a split-sum BRDF LUT. The current storage/sampling path remains equirectangular rather than a cubemap, so cubemap seam/pole quality and offline PMREM parity remain future fidelity work.
- Spot lights render on WebGL2 and WebGPU with bounded selection. Spot-light shadows are not implemented.
- Shadow budgets select eligible lights and resolutions but do not create shadow maps.
- The standard material uses GGX metallic/roughness PBR with energy-conserving image-based lighting. Advanced glTF extension texture slots and physically complete refractive transmission remain incomplete.

## Recovery

- WebGPU device recreation and WebGL context-restoration coordination are implemented, but physical browser/driver loss testing remains required before stable promotion.
- Resource restorers must retain or reconstruct CPU-side source data. Recovery cannot recreate resources that the host has discarded.

## Existing platform limits

- WebGPU XR bindings are not included; WebXR presentation remains WebGL2.
- Wireframe and full GPU post-processing graphs are not implemented.
- Very large exact-triangle picking workloads should use the optional spatial candidate index or bounds precision.
- APIs remain pre-1.0 and optional 0.8 contracts may change between release candidates.
