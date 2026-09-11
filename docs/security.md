# Security

Sekai64 validates scene data and assets before using them. Your app still needs to decide which sources it trusts and how much data it will accept.

## Scene data

JSON scenes cannot contain executable expressions: Sekai64 does not run `eval` or `Function` on scene data. Validation rejects non-plain objects and the keys `__proto__`, `prototype`, and `constructor`.

Scenes are limited to 10,000 root objects, a hierarchy depth of 64, and a general nesting depth of 96. Duplicate IDs are rejected, and validation errors identify the failing JSON path.

Object types come from the built-in allowlist or explicitly registered plugin factories. Interaction actions use registered handlers, and patches are limited to supported paths and operations.

## Asset requests

`AssetManager` checks allowed protocols before fetching and supports cancellation, bounded concurrency, finite retries, and custom resolvers. The glTF loader checks versions, GLB headers and chunk boundaries, accessor types, and buffer ranges. Unsupported binary features fail with an error.

Set domain and response-size limits for your app. If you use automatic Draco decoding, also configure where decoder scripts and binaries can load from; see [Draco setup](assets-gltf.md#draco-compression).

## Browser and XR integration

Navigation actions use configured protocols. Scene data does not generate DOM text or HTML, and your app must provide DOM overlays explicitly.

WebXR session requests follow browser permission rules and require a user gesture for immersive entry. See [WebXR](xr.md) for session setup and cleanup.
