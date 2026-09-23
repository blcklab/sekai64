# Assets and glTF

`AssetManager` owns network policy, concurrency, cancellation, caching, and reusable asset leases. `GltfLoader` maps glTF 2.0 and GLB data into native Sekai64 geometry, materials, textures, and scene nodes.

```ts
import { AssetManager } from '@blcklab/sekai64/assets'
import { GltfLoader } from '@blcklab/sekai64/gltf'

const assets = new AssetManager({
  baseUrl: '/assets/',
  concurrency: 6,
  allowedProtocols: ['https:', 'data:', 'blob:']
})

const loader = new GltfLoader(assets)
const model = await loader.loadNode('/models/product.glb', {
  signal: controller.signal,
  onProgress(progress) {
    console.log(progress.loaded, progress.total)
  }
})

scene.add(model)
model.dispose()
loader.dispose()
assets.dispose()
```

## Supported glTF sources

- `.glb` geometry buffers and embedded image `bufferView` resources
- `.gltf` external buffers and image URLs resolved relative to the document
- Buffer and image data URIs
- PNG, JPEG, and WebP images

External `.gltf` documents, buffers, and images must be served with valid CORS headers. A GLB with embedded images normally needs CORS only for the GLB request itself.

## Geometry and attributes

The loader supports triangle primitives, hierarchy, transforms, indices, `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`, `TEXCOORD_1`, and `COLOR_0`. Vertex colors support float RGB/RGBA plus normalized unsigned-byte and unsigned-short values. RGB colors receive alpha `1`.

Sparse glTF accessors are supported across ordinary geometry, morph targets, skin/joint data, animation data, and accessors with no base `bufferView` (zero-initialized according to glTF 2.0).

## Draco-compressed GLB/VRM

`KHR_draco_mesh_compression` is decoded lazily in browsers. No Draco bytes are downloaded unless an asset actually uses the extension.

```ts
const model = await loader.loadNode('/models/premium.glb')
```

For offline apps or strict Content Security Policy deployments, self-host the official Draco browser decoder files and point Sekai64 at that folder:

```ts
const model = await loader.loadNode('/models/premium.glb', {
  dracoDecoderPath: '/draco/'
})
```

Use `draco: false` to forbid automatic decoder loading, or pass a custom `GltfDracoDecoder` through `draco`.

## Materials and textures

The loader preserves:

- Base-color factors and sRGB base-color textures
- Scalar metallic and roughness factors
- Linear packed metallic-roughness textures (`G` roughness, `B` metallic)
- Linear normal textures and normal scale
- sRGB emissive textures multiplied by emissive factor
- Linear occlusion textures using the red channel and strength
- `OPAQUE`, `MASK`, and `BLEND` alpha modes
- Alpha cutoff
- Double-sided materials
- Texture coordinate selection between UV0 and UV1
- glTF wrapping and minification/magnification sampler constants
- glTF UV orientation with `flipY: false`

```ts
import { GLTF_LOADER_CAPABILITIES } from '@blcklab/sekai64/gltf'

console.log(GLTF_LOADER_CAPABILITIES.materialTextures)
```

Textures shared by multiple materials are fetched, decoded, and uploaded once per asset when their image, color space, and sampler state match. Asset disposal releases shared textures only after model-owned materials and geometry are released.

## Renderer behavior

WebGL2 generates requested mip chains. WebGPU currently uploads and samples the base mip level and emits `SEKAI64_WEBGPU_MIPMAP_GENERATION_UNAVAILABLE` when a glTF sampler requests mipmaps.

The standard shader evaluates imported metallic/roughness materials with GGX direct lighting and split-sum image-based lighting. glTF color factors remain linear as required by the glTF specification; sRGB base-color/emissive textures are decoded by the GPU exactly once before lighting.

## Diagnostics

Malformed image, texture, sampler, and UV references fail with stable codes such as:

```txt
SEKAI_GLTF_IMAGE_NOT_FOUND
SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID
SEKAI_GLTF_IMAGE_MIME_UNSUPPORTED
SEKAI_GLTF_TEXTURE_INDEX_INVALID
SEKAI_GLTF_TEXTURE_SOURCE_INVALID
SEKAI_GLTF_SAMPLER_INVALID
SEKAI_GLTF_UV_SET_MISSING
SEKAI_GLTF_TEXTURE_DECODE_FAILED
```

A missing tangent attribute does not silently disable a normal texture. Sekai64 reports `SEKAI_GLTF_NORMAL_TANGENT_MISSING` and uses derivative-based tangent reconstruction.

## Current unsupported glTF features

- Meshopt compression
- KTX2/Basis Universal
- `KHR_texture_transform`
- Texture slots for advanced material extensions such as clearcoat, transmission, sheen, specular, and volume (their scalar/color factors are supported)
- Physically complete refractive transmission/volume and iridescence
- glTF cameras and punctual-light extensions

Unsupported functionality is not advertised as implemented.
