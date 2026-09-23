# Streaming and decoder adapters

`@blcklab/sekai64/streaming` provides priority scheduling, request deduplication, leases/reference counts, cancellation, and worker-compatible task execution.

`@blcklab/sekai64/decoders` is only a registry and contract. It does not contain codec code.

Optional bridges are separate packages:

- `@blcklab/sekai64-draco`
- `@blcklab/sekai64-meshopt`
- `@blcklab/sekai64-ktx2`

Each bridge requires a host-provided decoder/transcoder. This keeps WASM, workers, and licensing choices outside the Sekai64 root bundle.
