# Assets and glTF

Use `loadModel()` to load a glTF, GLB, or binary VRM model and add it to your scene:

```ts
import { loadModel } from '@blcklab/sekai64/gltf'

const model = await loadModel('/models/product.glb')
scene.add(model)

// When the model is no longer needed:
model.dispose()
```

For animated assets, follow the [animation guide](animation-and-animated-gltf.md) or pass `animatedFallback: 'static-pose'` if you only need a still model.

## Control loading and caching

Use `AssetManager` and `GltfLoader` directly when you need shared caching, concurrency limits, cancellation, or a custom URL policy. These examples assume an existing `scene`.

```ts
import { AssetManager } from '@blcklab/sekai64/assets'
import { GltfLoader } from '@blcklab/sekai64/gltf'

const assets = new AssetManager({
  concurrency: 6,
  allowedProtocols: ['https:', 'data:', 'blob:']
})
const loader = new GltfLoader(assets)
const controller = new AbortController()

const model = await loader.loadNode('/models/product.glb', {
  signal: controller.signal,
  onProgress(progress) {
    console.log(progress.loaded, progress.total)
  }
})
scene.add(model)
```

Call `controller.abort()` to cancel the request. The protocol policy above assumes HTTPS; add `http:` if your local development server needs it.

When removing the model, call `model.dispose()`. When shutting down the shared loader, dispose its models first, then call `loader.dispose()` and `assets.dispose()`.

## Files and geometry

The loader accepts GLB buffers and embedded images, external `.gltf` buffers and images, and data URIs. Supported image formats are PNG, JPEG, and WebP. External paths resolve relative to the glTF document.

Cross-origin requests need valid CORS headers. For a self-contained GLB, only the GLB request needs them; a `.gltf` file may also request separate buffers and images.

Geometry support includes triangle primitives, hierarchy, transforms, indices, `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`, `TEXCOORD_1`, and `COLOR_0`. Vertex colors accept float RGB/RGBA or normalized unsigned-byte/unsigned-short values. RGB colors get an alpha of `1`.

Sparse accessors work for geometry, morph targets, skin/joint data, and animations. An accessor without a base `bufferView` starts with zero values before sparse overrides are applied.

## Draco compression

In browsers, the loader fetches a Draco decoder only when an asset uses `KHR_draco_mesh_compression`. The default decoder comes from Google's hosted Draco files.

For offline use or a restrictive Content Security Policy, self-host the decoder files and point the loader to their folder:

```ts
const model = await loader.loadNode('/models/premium.glb', {
  dracoDecoderPath: '/draco/'
})
```

Set `draco: false` to disable automatic loading, or pass your own `GltfDracoDecoder` through `draco`.

## Materials and textures

| Property | Imported behavior |
| --- | --- |
| Base color | Linear factor and sRGB texture |
| Metallic / roughness | Scalar factors and a linear packed texture: `G` roughness, `B` metallic |
| Normal | Linear texture with normal scale |
| Emissive | sRGB texture multiplied by the emissive factor |
| Occlusion | Linear texture, red channel, with strength |
| Alpha | `OPAQUE`, `MASK`, `BLEND`, and alpha cutoff |
| Faces | Double-sided material setting |
| UVs | UV0 or UV1, with `flipY: false` |
| Samplers | glTF wrapping, minification, and magnification settings |

The loader also imports legacy VRM MToon and `VRMC_materials_mtoon` materials. See [anime rendering](anime-rendering.md).

Matching image, color-space, and sampler combinations share a texture within an asset. Disposing the model releases its materials and geometry before releasing shared asset textures.

Both backends support mipmaps for loaded textures, subject to renderer quality settings. The [dynamic-texture API](dynamic-textures.md#mipmaps-and-size-limits) has a separate WebGPU restriction.

Standard PBR materials use GGX lighting and split-sum image-based lighting. Color factors stay linear; sRGB base-color and emissive textures are decoded once before lighting.

To inspect the loader's supported features in code:

```ts
import { GLTF_LOADER_CAPABILITIES } from '@blcklab/sekai64/gltf'

console.log(GLTF_LOADER_CAPABILITIES.materialTextures)
```

## Troubleshooting

Malformed image, texture, sampler, or UV references report codes such as:

```text
SEKAI_GLTF_IMAGE_NOT_FOUND
SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID
SEKAI_GLTF_IMAGE_MIME_UNSUPPORTED
SEKAI_GLTF_TEXTURE_INDEX_INVALID
SEKAI_GLTF_TEXTURE_SOURCE_INVALID
SEKAI_GLTF_SAMPLER_INVALID
SEKAI_GLTF_UV_SET_MISSING
SEKAI_GLTF_TEXTURE_DECODE_FAILED
```

A missing tangent attribute reports `SEKAI_GLTF_NORMAL_TANGENT_MISSING`. The renderer reconstructs tangents from derivatives, so the normal texture still works.

## Unsupported features

The loader does not yet handle Meshopt compression, KTX2/Basis Universal, `KHR_texture_transform`, glTF cameras, or punctual-light extensions.

Advanced material extensions such as clearcoat, transmission, sheen, specular, and volume support scalar/color factors, but their texture slots are incomplete. Physically complete refractive transmission/volume and iridescence are also unfinished. See [known limitations](limitations.md).
