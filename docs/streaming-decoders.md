# Streaming and decoders

Use `@blcklab/sekai64/streaming` to prioritize asset work, deduplicate requests, cancel tasks, and share loaded results through reference-counted leases. Worker-compatible task execution is available when you want to move work off the main thread.

`RegionStreamingController` loads and releases regions by distance from a reference point, such as the camera. Your app supplies each region's load and disposal callbacks. Progressive mesh/texture refinement and HTTP range streaming are not implemented.

## External codecs

`@blcklab/sekai64/decoders` defines the decoder registry and interfaces. Codec implementations come from your app through these separate bridge packages:

| Format | Bridge |
| --- | --- |
| Draco | `@blcklab/sekai64-draco` |
| Meshopt | `@blcklab/sekai64-meshopt` |
| KTX2 / Basis | `@blcklab/sekai64-ktx2` |

Each bridge needs a decoder or transcoder supplied by your app. You also control worker creation, hosting, versioning, and codec licensing. Installing a bridge alone does not add support to the glTF loader.

The glTF loader has a separate automatic Draco path: it fetches the browser decoder only when an asset needs it. You can self-host that decoder, provide your own, or disable automatic loading. See [Draco compression](assets-gltf.md#draco-compression).
