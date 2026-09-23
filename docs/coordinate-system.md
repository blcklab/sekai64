# Coordinate System

- Handedness: right-handed
- Up axis: `+Y`
- Forward axis: `-Z`
- Right axis: `+X`
- Matrix storage: column-major
- Transform order: scale, then XYZ Euler rotation, then translation
- Public angle unit: radians, except perspective field of view which is degrees
- Camera projection: OpenGL-style `-1..1` depth in the backend-neutral matrix
- WebGPU conversion: the WebGPU vertex stage remaps clip-space depth to `0..1`

The neutral projection convention keeps one camera representation across both backends while making the conversion explicit inside the WebGPU backend.
