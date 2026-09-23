import { ManagedResource } from '@sekai64-internal/core'
import { Box3 } from '@sekai64-internal/math'

export interface GeometryGroup {
  /** First index/vertex in the triangle-list draw range. */
  start: number
  /** Number of indices/vertices in the triangle-list draw range. */
  count: number
  /** Material slot selected from Mesh.materials. */
  materialIndex: number
  /** Optional semantic region name preserved from the authoring layer. */
  name?: string
}

export interface GeometryData {
  positions: Float32Array
  normals?: Float32Array
  uvs?: Float32Array
  uvs1?: Float32Array
  colors?: Float32Array
  tangents?: Float32Array
  indices?: Uint16Array | Uint32Array
  groups?: readonly GeometryGroup[]
}

export class Geometry extends ManagedResource {
  readonly positions: Float32Array
  readonly normals?: Float32Array
  readonly uvs?: Float32Array
  readonly uvs1?: Float32Array
  readonly colors?: Float32Array
  readonly tangents?: Float32Array
  readonly indices?: Uint16Array | Uint32Array
  readonly groups: readonly GeometryGroup[]
  readonly bounds: Box3
  readonly triangleCount: number
  version = 0

  constructor(data: GeometryData, label?: string) {
    super(label)
    if (data.positions.length % 3 !== 0) throw new Error('Geometry positions must contain xyz triplets.')
    const vertexCount = data.positions.length / 3
    if (data.normals && data.normals.length !== data.positions.length) throw new Error('Geometry normals must match the positions length.')
    if (data.uvs && data.uvs.length / 2 !== vertexCount) throw new Error('Geometry UV0 count must match the vertex count.')
    if (data.uvs1 && data.uvs1.length / 2 !== vertexCount) throw new Error('Geometry UV1 count must match the vertex count.')
    if (data.colors && data.colors.length / 4 !== vertexCount) throw new Error('Geometry color count must match the vertex count and use RGBA values.')
    if (data.tangents && data.tangents.length / 4 !== vertexCount) throw new Error('Geometry tangent count must match the vertex count and use xyzw values.')
    this.positions = data.positions
    this.normals = data.normals
    this.uvs = data.uvs
    this.uvs1 = data.uvs1
    this.colors = data.colors
    this.tangents = data.tangents
    this.indices = data.indices
    const drawCount = this.indices ? this.indices.length : vertexCount
    const groups = data.groups ?? []
    let previousEnd = 0
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index]!
      if (!Number.isSafeInteger(group.start) || !Number.isSafeInteger(group.count) || !Number.isSafeInteger(group.materialIndex) || group.start < 0 || group.count <= 0 || group.materialIndex < 0 || group.start % 3 !== 0 || group.count % 3 !== 0 || group.start + group.count > drawCount) {
        throw new Error(`Geometry group ${index} must be a non-negative triangle-aligned draw range with a valid materialIndex.`)
      }
      if (group.start < previousEnd) throw new Error(`Geometry group ${index} overlaps a previous draw range.`)
      previousEnd = group.start + group.count
    }
    this.groups = Object.freeze(groups.map(group => Object.freeze({ ...group })))
    this.bounds = new Box3().setFromArray(this.positions)
    this.triangleCount = this.indices ? this.indices.length / 3 : this.positions.length / 9
  }

  markUpdated(recomputeBounds = true): this {
    this.assertAlive()
    if (recomputeBounds) this.bounds.setFromArray(this.positions)
    this.version += 1
    return this
  }

  protected release(): void {
    this.version += 1
  }
}
