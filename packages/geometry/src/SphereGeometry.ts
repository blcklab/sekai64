import { Geometry } from './Geometry.js'

export interface SphereGeometryOptions {
  radius?: number
  widthSegments?: number
  heightSegments?: number
  label?: string
}

/** Indexed Y-up UV sphere geometry. Defaults are intentionally compact for real-time world primitives. */
export class SphereGeometry extends Geometry {
  constructor(options: SphereGeometryOptions = {}) {
    const radius = options.radius ?? 0.5
    const widthSegments = Math.floor(options.widthSegments ?? 16)
    const heightSegments = Math.floor(options.heightSegments ?? 10)

    if (!Number.isFinite(radius) || !(radius > 0)) throw new Error('SphereGeometry radius must be finite and greater than zero.')
    if (!Number.isFinite(widthSegments) || widthSegments < 3) throw new Error('SphereGeometry widthSegments must be finite and at least 3.')
    if (!Number.isFinite(heightSegments) || heightSegments < 2) throw new Error('SphereGeometry heightSegments must be finite and at least 2.')

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const row = widthSegments + 1

    for (let yIndex = 0; yIndex <= heightSegments; yIndex += 1) {
      const v = yIndex / heightSegments
      const phi = v * Math.PI
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      for (let xIndex = 0; xIndex <= widthSegments; xIndex += 1) {
        const u = xIndex / widthSegments
        const theta = u * Math.PI * 2
        const sinTheta = Math.sin(theta)
        const cosTheta = Math.cos(theta)
        const nx = sinPhi * sinTheta
        const ny = cosPhi
        const nz = sinPhi * cosTheta
        positions.push(radius * nx, radius * ny, radius * nz)
        normals.push(nx, ny, nz)
        uvs.push(u, 1 - v)
      }
    }

    for (let yIndex = 0; yIndex < heightSegments; yIndex += 1) {
      for (let xIndex = 0; xIndex < widthSegments; xIndex += 1) {
        const a = yIndex * row + xIndex
        const b = (yIndex + 1) * row + xIndex
        const c = b + 1
        const d = a + 1
        if (yIndex !== 0) indices.push(a, b, d)
        if (yIndex !== heightSegments - 1) indices.push(b, c, d)
      }
    }

    const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array
    super({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new IndexArray(indices),
    }, options.label)
  }
}
