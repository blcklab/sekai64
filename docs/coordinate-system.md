# Coordinate system

Sekai64 uses a right-handed coordinate system: `+Y` is up, `-Z` is forward, and `+X` is right.

| Convention | Value |
| --- | --- |
| Matrix storage | Column-major |
| Transform order | Scale, XYZ Euler rotation, then translation |
| Angles | Radians |
| Perspective field of view | Degrees |
| Camera projection depth | `-1..1` |

Both renderers use the same camera matrices. The WebGPU vertex stage converts clip-space depth to `0..1` for you.
