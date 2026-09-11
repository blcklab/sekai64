import { Geometry, type GeometryData } from '@sekai64-internal/geometry'
import type { SkeletonResource } from './Skeleton.js'

export interface MorphTargetData {
  name: string
  positions?: Float32Array
  normals?: Float32Array
}

export interface SkinnedGeometryData extends GeometryData {
  jointIndices?: Uint8Array | Uint16Array
  jointWeights?: Float32Array
  morphTargets?: readonly MorphTargetData[]
}

export class SkinnedGeometry extends Geometry {
  readonly basePositions: Float32Array
  readonly baseNormals?: Float32Array
  readonly jointIndices?: Uint16Array
  readonly jointWeights?: Float32Array
  readonly morphTargets: readonly MorphTargetData[]
  readonly morphWeights: Float32Array
  private readonly morphedPositions: Float32Array
  private readonly morphedNormals?: Float32Array

  constructor(data: SkinnedGeometryData, label?: string) {
    super(data, label)
    const vertexCount = data.positions.length / 3
    if ((data.jointIndices === undefined) !== (data.jointWeights === undefined)) throw new Error('Skinned geometry requires both jointIndices and jointWeights.')
    if (data.jointIndices && data.jointIndices.length !== vertexCount * 4) throw new Error('Skinned geometry jointIndices must contain four values per vertex.')
    if (data.jointWeights && data.jointWeights.length !== vertexCount * 4) throw new Error('Skinned geometry jointWeights must contain four values per vertex.')
    for (const target of data.morphTargets ?? []) {
      if (target.positions && target.positions.length !== data.positions.length) throw new Error(`Morph target ${target.name} positions must match the base geometry.`)
      if (target.normals && target.normals.length !== data.positions.length) throw new Error(`Morph target ${target.name} normals must match the base geometry.`)
    }
    this.basePositions = data.positions.slice()
    this.baseNormals = data.normals?.slice()
    this.jointIndices = data.jointIndices ? Uint16Array.from(data.jointIndices) : undefined
    this.jointWeights = data.jointWeights?.slice()
    this.morphTargets = (data.morphTargets ?? []).map(target => ({
      name: target.name,
      ...(target.positions ? { positions: target.positions.slice() } : {}),
      ...(target.normals ? { normals: target.normals.slice() } : {}),
    }))
    this.morphWeights = new Float32Array(this.morphTargets.length)
    this.morphedPositions = new Float32Array(this.basePositions.length)
    this.morphedNormals = this.baseNormals ? new Float32Array(this.baseNormals.length) : undefined
  }

  setMorphWeight(indexOrName: number | string, weight: number): this {
    this.assertAlive()
    const index = typeof indexOrName === 'number' ? indexOrName : this.morphTargets.findIndex(target => target.name === indexOrName)
    if (index < 0 || index >= this.morphWeights.length) throw new RangeError(`Unknown morph target: ${String(indexOrName)}`)
    this.morphWeights[index] = Number.isFinite(weight) ? weight : 0
    return this
  }

  setMorphWeights(weights: ArrayLike<number>): this {
    this.assertAlive()
    for (let index = 0; index < this.morphWeights.length; index += 1) this.morphWeights[index] = weights[index] ?? 0
    return this
  }

  deform(skeleton?: SkeletonResource): this {
    this.assertAlive()
    this.morphedPositions.set(this.basePositions)
    if (this.baseNormals && this.morphedNormals) this.morphedNormals.set(this.baseNormals)
    for (let targetIndex = 0; targetIndex < this.morphTargets.length; targetIndex += 1) {
      const target = this.morphTargets[targetIndex]
      const weight = this.morphWeights[targetIndex] ?? 0
      if (!target || weight === 0) continue
      if (target.positions) addWeighted(this.morphedPositions, target.positions, weight)
      if (target.normals && this.morphedNormals) addWeighted(this.morphedNormals, target.normals, weight)
    }
    if (skeleton && this.jointIndices && this.jointWeights) {
      skeleton.update()
      skinPositions(this.morphedPositions, this.positions, this.jointIndices, this.jointWeights, skeleton.palette)
      if (this.morphedNormals && this.normals) skinNormals(this.morphedNormals, this.normals, this.jointIndices, this.jointWeights, skeleton.palette)
    } else {
      this.positions.set(this.morphedPositions)
      if (this.morphedNormals && this.normals) this.normals.set(this.morphedNormals)
    }
    return this.markUpdated(true)
  }
}

function addWeighted(target: Float32Array, delta: Float32Array, weight: number): void {
  for (let index = 0; index < target.length; index += 1) target[index] = (target[index] ?? 0) + (delta[index] ?? 0) * weight
}

function skinPositions(
  source: Float32Array,
  target: Float32Array,
  joints: Uint16Array,
  weights: Float32Array,
  palette: Float32Array,
): void {
  const vertexCount = source.length / 3
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = source[vertex * 3] ?? 0
    const y = source[vertex * 3 + 1] ?? 0
    const z = source[vertex * 3 + 2] ?? 0
    let outputX = 0, outputY = 0, outputZ = 0, total = 0
    for (let influence = 0; influence < 4; influence += 1) {
      const slot = vertex * 4 + influence
      const weight = weights[slot] ?? 0
      if (weight === 0) continue
      const matrixOffset = (joints[slot] ?? 0) * 16
      outputX += ((palette[matrixOffset] ?? 1) * x + (palette[matrixOffset + 4] ?? 0) * y + (palette[matrixOffset + 8] ?? 0) * z + (palette[matrixOffset + 12] ?? 0)) * weight
      outputY += ((palette[matrixOffset + 1] ?? 0) * x + (palette[matrixOffset + 5] ?? 1) * y + (palette[matrixOffset + 9] ?? 0) * z + (palette[matrixOffset + 13] ?? 0)) * weight
      outputZ += ((palette[matrixOffset + 2] ?? 0) * x + (palette[matrixOffset + 6] ?? 0) * y + (palette[matrixOffset + 10] ?? 1) * z + (palette[matrixOffset + 14] ?? 0)) * weight
      total += weight
    }
    const inverse = total > 0 ? 1 / total : 1
    target[vertex * 3] = total > 0 ? outputX * inverse : x
    target[vertex * 3 + 1] = total > 0 ? outputY * inverse : y
    target[vertex * 3 + 2] = total > 0 ? outputZ * inverse : z
  }
}

function skinNormals(
  source: Float32Array,
  target: Float32Array,
  joints: Uint16Array,
  weights: Float32Array,
  palette: Float32Array,
): void {
  const vertexCount = source.length / 3
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = source[vertex * 3] ?? 0
    const y = source[vertex * 3 + 1] ?? 0
    const z = source[vertex * 3 + 2] ?? 0
    let outputX = 0, outputY = 0, outputZ = 0, total = 0
    for (let influence = 0; influence < 4; influence += 1) {
      const slot = vertex * 4 + influence
      const weight = weights[slot] ?? 0
      if (weight === 0) continue
      const matrixOffset = (joints[slot] ?? 0) * 16
      outputX += ((palette[matrixOffset] ?? 1) * x + (palette[matrixOffset + 4] ?? 0) * y + (palette[matrixOffset + 8] ?? 0) * z) * weight
      outputY += ((palette[matrixOffset + 1] ?? 0) * x + (palette[matrixOffset + 5] ?? 1) * y + (palette[matrixOffset + 9] ?? 0) * z) * weight
      outputZ += ((palette[matrixOffset + 2] ?? 0) * x + (palette[matrixOffset + 6] ?? 0) * y + (palette[matrixOffset + 10] ?? 1) * z) * weight
      total += weight
    }
    const length = Math.hypot(outputX, outputY, outputZ) || 1
    target[vertex * 3] = total > 0 ? outputX / length : x
    target[vertex * 3 + 1] = total > 0 ? outputY / length : y
    target[vertex * 3 + 2] = total > 0 ? outputZ / length : z
  }
}
