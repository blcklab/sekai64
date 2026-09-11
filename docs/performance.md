# Performance

Measure with your own scenes on the browsers and GPUs you plan to support. A result from a small demo may not carry over to a world with large textures, animated characters, or frequent updates.

## What to measure

Track frame time alongside draw calls, triangles, visible and culled objects, pipeline changes, and estimated geometry and texture memory. Watch for spikes as well as averages.

Useful scenarios include:

- Engine startup and the first visible frame.
- Creation and transform updates for 1,000 and 10,000 nodes.
- Repeated geometry with and without instancing.
- Large buildings and scenes with many picking candidates.
- Scene loading, patching, serialization, and disposal.
- Repeated load/dispose cycles to check for retained resources.

## Compare equivalent output

Keep the camera, visible content, resolution, and quality settings matched. Record the browser, GPU, OS, renderer backend, package versions, build mode, scene complexity, warm-up procedure, and sample count with each result.

For shared geometry and cheaper picking, see [renderer adapters](renderer-adapters.md). For CPU deformation costs, see [animation](animation-and-animated-gltf.md#playback-and-limits).
