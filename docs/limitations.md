# Known limitations

Check these gaps against the features your app needs. The 0.8 series is still in release candidate, so pin a tested version and review the [changelog](../CHANGELOG.md) before upgrading.

## Animation

- Skinning and morph deformation run on the CPU and upload geometry updates each frame. Native GPU skinning and morph evaluation are not implemented.
- glTF tracks support translation, rotation, scale, and weights with `LINEAR` or `STEP` interpolation. `CUBICSPLINE` is not supported. Sparse accessors are supported.
- Additive layers, animation graphs, gameplay state machines, and root-motion policies are not built in.

See [animation setup](animation-and-animated-gltf.md).

## Assets and streaming

- Decoder bridges require a codec implementation supplied by your app. The glTF loader can fetch a Draco browser decoder automatically; see [Draco configuration](assets-gltf.md#draco-compression).
- Meshopt and KTX2/Basis loading are not integrated into the glTF loader. `KHR_texture_transform`, glTF cameras, and punctual-light extensions are also unsupported.
- Progressive mesh/texture refinement and HTTP range streaming are not implemented. Your app supplies and hosts any workers.

## Materials and lighting

- Advanced glTF material extensions support scalar/color factors, but their texture slots are incomplete. Physically complete refractive transmission, volume, and iridescence are not implemented.
- Environment lighting uses equirectangular maps with diffuse irradiance and prefiltered specular levels. Cubemap storage and offline PMREM parity remain unfinished.
- Both backends render directional shadows. Spot-light shadows are not implemented; shadow budgets only select lights and resolutions.
- The dynamic-texture API disables mipmap generation on WebGPU, even though ordinary loaded textures can use mipmaps. See [dynamic textures](dynamic-textures.md#mipmaps-and-size-limits).

## Recovery and platform support

- Recovery needs retained CPU data or a way to reconstruct it. Test browser and driver loss on your target devices before relying on automatic recovery.
- WebXR presentation uses WebGL2. WebGPU XR bindings are not included.
- Wireframe rendering is not implemented.
- Exact triangle picking can be expensive in large scenes. Use a spatial candidate index or bounds precision where appropriate.
