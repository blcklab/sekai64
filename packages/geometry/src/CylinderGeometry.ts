import { Geometry } from './Geometry.js'

export interface CylinderGeometryOptions {
  radiusTop?: number
  radiusBottom?: number
  height?: number
  radialSegments?: number
  heightSegments?: number
  openEnded?: boolean
  thetaStart?: number
  thetaLength?: number
  label?: string
}

/** Indexed Y-up cylinder/frustum geometry with optional top and bottom caps. */
export class CylinderGeometry extends Geometry {
  constructor(options: CylinderGeometryOptions = {}) {
    const radiusTop = options.radiusTop ?? 0.5
    const radiusBottom = options.radiusBottom ?? 0.5
    const height = options.height ?? 1
    const radialSegments = Math.floor(options.radialSegments ?? 24)
    const heightSegments = Math.floor(options.heightSegments ?? 1)
    const openEnded = options.openEnded ?? false
    const thetaStart = options.thetaStart ?? 0
    const thetaLength = options.thetaLength ?? Math.PI * 2

    if (radiusTop < 0 || radiusBottom < 0 || (radiusTop === 0 && radiusBottom === 0)) throw new Error('CylinderGeometry requires at least one positive radius.')
    if (!(height > 0)) throw new Error('CylinderGeometry height must be greater than zero.')
    if (radialSegments < 3) throw new Error('CylinderGeometry radialSegments must be at least 3.')
    if (heightSegments < 1) throw new Error('CylinderGeometry heightSegments must be at least 1.')
    if (!(thetaLength > 0) || thetaLength > Math.PI * 2) throw new Error('CylinderGeometry thetaLength must be in the range (0, 2π].')

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const halfHeight = height / 2
    const slope = (radiusBottom - radiusTop) / height
    const row = radialSegments + 1

    for (let yIndex = 0; yIndex <= heightSegments; yIndex += 1) {
      const v = yIndex / heightSegments
      const radius = radiusTop + (radiusBottom - radiusTop) * v
      const y = halfHeight - v * height
      for (let xIndex = 0; xIndex <= radialSegments; xIndex += 1) {
        const u = xIndex / radialSegments
        const theta = thetaStart + u * thetaLength
        const sin = Math.sin(theta)
        const cos = Math.cos(theta)
        positions.push(radius * sin, y, radius * cos)
        const normalLength = Math.hypot(1, slope)
        normals.push(sin / normalLength, slope / normalLength, cos / normalLength)
        uvs.push(u, 1 - v)
      }
    }

    for (let yIndex = 0; yIndex < heightSegments; yIndex += 1) {
      for (let xIndex = 0; xIndex < radialSegments; xIndex += 1) {
        const a = yIndex * row + xIndex
        const b = (yIndex + 1) * row + xIndex
        const c = (yIndex + 1) * row + xIndex + 1
        const d = yIndex * row + xIndex + 1
        indices.push(a, b, d, b, c, d)
      }
    }

    if (!openEnded) {
      if (radiusTop > 0) addCap(true, radiusTop, halfHeight, radialSegments, thetaStart, thetaLength, positions, normals, uvs, indices)
      if (radiusBottom > 0) addCap(false, radiusBottom, -halfHeight, radialSegments, thetaStart, thetaLength, positions, normals, uvs, indices)
    }

    const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array
    super({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new IndexArray(indices)
    }, options.label)
  }
}

function addCap(
  top: boolean,
  radius: number,
  y: number,
  radialSegments: number,
  thetaStart: number,
  thetaLength: number,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[]
): void {
  const centerIndex = positions.length / 3
  positions.push(0, y, 0)
  normals.push(0, top ? 1 : -1, 0)
  uvs.push(0.5, 0.5)

  const ringStart = positions.length / 3
  for (let index = 0; index <= radialSegments; index += 1) {
    const u = index / radialSegments
    const theta = thetaStart + u * thetaLength
    const sin = Math.sin(theta)
    const cos = Math.cos(theta)
    positions.push(radius * sin, y, radius * cos)
    normals.push(0, top ? 1 : -1, 0)
    uvs.push(sin * 0.5 + 0.5, cos * 0.5 + 0.5)
  }

  for (let index = 0; index < radialSegments; index += 1) {
    const current = ringStart + index
    const next = current + 1
    if (top) indices.push(centerIndex, next, current)
    else indices.push(centerIndex, current, next)
  }
}
