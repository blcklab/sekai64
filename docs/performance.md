# Performance Methodology

Sekai64 does not claim universal superiority. Benchmarks must compare equivalent visible output and disclose browser, GPU, operating system, backend, build mode, scene complexity, package versions, warm-up procedure, and sample count.

Initial benchmark scenarios:

1. Engine initialization and first frame.
2. Creation and transform update of 1,000 and 10,000 nodes.
3. Repeated indexed boxes before and after instancing support.
4. Large generated buildings as the architecture module matures.
5. Scene load, patch, serialization, and disposal.
6. GPU resource cleanup and retained-memory checks.

Tracked runtime values include frame time, draw calls, triangles, visible objects, culled objects, pipeline changes, and estimated geometry/texture memory.
