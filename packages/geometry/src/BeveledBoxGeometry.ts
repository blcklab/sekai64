import { Geometry } from './Geometry.js'

export interface BeveledBoxGeometryOptions {
  width?: number
  height?: number
  depth?: number
  bevelRadius?: number
  bevelSegments?: number
  label?: string
}

/**
 * A compact rounded/chamfered cuboid intended for procedural architecture.
 * Each face is generated independently so UVs remain predictable and seams
 * stay hard only where the requested bevel radius reaches zero.
 */
export class BeveledBoxGeometry extends Geometry {
  constructor(options: BeveledBoxGeometryOptions = {}) {
    const width = options.width ?? 1
    const height = options.height ?? 1
    const depth = options.depth ?? 1
    if (width <= 0 || height <= 0 || depth <= 0) throw new Error('BeveledBoxGeometry dimensions must be greater than zero.')
    const maximumRadius = Math.min(width, height, depth) * 0.5
    const radius = Math.min(maximumRadius, Math.max(0, options.bevelRadius ?? Math.min(width, height, depth) * 0.04))
    const segments = Math.max(1, Math.min(8, Math.floor(options.bevelSegments ?? 2)))
    if (radius <= 1e-8) {
      const plain = createRoundedBox(width, height, depth, 0, 1)
      super(plain, options.label)
      return
    }
    super(createRoundedBox(width, height, depth, radius, segments), options.label)
  }
}

function createRoundedBox(width: number, height: number, depth: number, radius: number, segments: number): {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint16Array | Uint32Array
} {
  const half = [width * 0.5, height * 0.5, depth * 0.5] as const
  const coordinates = half.map(value => axisCoordinates(value, radius, segments))
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // axis is the fixed face axis; u/v select the two face grid axes.
  const faces = [
    { axis: 0, sign: 1, u: 2, v: 1, flip: false },
    { axis: 0, sign: -1, u: 2, v: 1, flip: true },
    { axis: 1, sign: 1, u: 0, v: 2, flip: false },
    { axis: 1, sign: -1, u: 0, v: 2, flip: true },
    { axis: 2, sign: 1, u: 0, v: 1, flip: true },
    { axis: 2, sign: -1, u: 0, v: 1, flip: false },
  ] as const

  for (const face of faces) {
    const uCoordinates = coordinates[face.u]!
    const vCoordinates = coordinates[face.v]!
    const base = positions.length / 3
    for (let row = 0; row < vCoordinates.length; row += 1) {
      for (let column = 0; column < uCoordinates.length; column += 1) {
        const point = [0, 0, 0]
        point[face.axis] = half[face.axis] * face.sign
        point[face.u] = uCoordinates[column] ?? 0
        point[face.v] = vCoordinates[row] ?? 0
        const rounded = roundedPoint(point, half, radius)
        positions.push(...rounded.position)
        normals.push(...rounded.normal)
        uvs.push(column / Math.max(1, uCoordinates.length - 1), row / Math.max(1, vCoordinates.length - 1))
      }
    }
    const columns = uCoordinates.length
    const rows = vCoordinates.length
    for (let row = 0; row < rows - 1; row += 1) {
      for (let column = 0; column < columns - 1; column += 1) {
        const a = base + row * columns + column
        const b = a + 1
        const c = a + columns + 1
        const d = a + columns
        if (face.flip) indices.push(a, c, b, a, d, c)
        else indices.push(a, b, c, a, c, d)
      }
    }
  }

  const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new IndexArray(indices),
  }
}

function axisCoordinates(half: number, radius: number, segments: number): number[] {
  if (radius <= 0) return [-half, half]
  const values: number[] = []
  for (let index = 0; index <= segments; index += 1) values.push(-half + radius * (index / segments))
  const positiveStart = half - radius
  if (positiveStart > -half + radius + 1e-8) values.push(positiveStart)
  for (let index = 1; index <= segments; index += 1) values.push(positiveStart + radius * (index / segments))
  return deduplicate(values)
}

function roundedPoint(point: number[], half: readonly number[], radius: number): {
  position: readonly [number, number, number]
  normal: readonly [number, number, number]
} {
  if (radius <= 0) {
    const absolute = point.map(Math.abs)
    const axis = absolute.indexOf(Math.max(...absolute))
    const normal = [0, 0, 0]
    normal[axis] = Math.sign(point[axis] ?? 1)
    return { position: point as [number, number, number], normal: normal as [number, number, number] }
  }
  const inner = half.map(value => Math.max(0, value - radius))
  const center = point.map((value, axis) => Math.max(-inner[axis]!, Math.min(inner[axis]!, value)))
  const offset = point.map((value, axis) => value - center[axis]!)
  const length = Math.hypot(offset[0]!, offset[1]!, offset[2]!) || 1
  const normal = offset.map(value => value / length)
  const position = center.map((value, axis) => value + normal[axis]! * radius)
  return {
    position: position as [number, number, number],
    normal: normal as [number, number, number],
  }
}

function deduplicate(values: readonly number[]): number[] {
  const output: number[] = []
  for (const value of values) if (output.length === 0 || Math.abs(value - output[output.length - 1]!) > 1e-8) output.push(value)
  return output
}
