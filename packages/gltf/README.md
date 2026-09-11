# @sekai64-internal/gltf

Private workspace module for Sekai64. It is compiled into the public `@blcklab/sekai64/gltf` subpath and is not published independently.


## RC.28 compatibility

Supports glTF sparse accessors (including sparse VRM morph/skin data) and lazy browser decoding for `KHR_draco_mesh_compression`. Use `dracoDecoderPath` to self-host decoder files or `draco: false` to disable automatic Draco decoding.
