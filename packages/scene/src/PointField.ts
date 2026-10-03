import { Node, type NodeOptions } from './Node.js'

export type PointFieldSpace = 'world' | 'directional'

export interface PointFieldPoint {
  position: readonly [number, number, number]
  color?: readonly [number, number, number] | readonly [number, number, number, number]
  size?: number
  intensity?: number
}

export interface PointFieldOptions extends NodeOptions {
  points?: readonly PointFieldPoint[]
  space?: PointFieldSpace
  defaultColor?: readonly [number, number, number] | readonly [number, number, number, number]
  defaultSize?: number
  defaultIntensity?: number
}

/**
 * Packed point set optimized for renderer-owned point-field drawing.
 * `directional` space interprets positions as direction vectors and ignores translation.
 * `setPoints()` replaces the packed point payload without replacing the scene node.
 */
export class PointField extends Node {
  space: PointFieldSpace
  positions: Float32Array = new Float32Array(0)
  colors: Float32Array = new Float32Array(0)
  sizes: Float32Array = new Float32Array(0)
  intensities: Float32Array = new Float32Array(0)
  count = 0
  pointVersion = 0

  private readonly defaultColor: readonly [number, number, number, number]
  private readonly defaultSize: number
  private readonly defaultIntensity: number

  constructor(options: PointFieldOptions = {}) {
    super(options)
    this.space = options.space ?? 'world'
    this.defaultColor = normalizeColor(options.defaultColor ?? [1, 1, 1, 1])
    this.defaultSize = finitePositive(options.defaultSize, 1)
    this.defaultIntensity = finiteNonNegative(options.defaultIntensity, 1)
    this.setPoints(options.points ?? [])
  }

  /**
   * Replaces the packed point payload and increments `pointVersion` so renderers can
   * refresh GPU buffers. Existing typed-array allocations are reused when the point
   * count is unchanged, which keeps high-frequency runtime updates allocation-light.
   */
  setPoints(points: readonly PointFieldPoint[]): this {
    if (!Array.isArray(points)) throw new Error('PointField.setPoints(points) requires an array.')
    const nextCount = points.length
    if (nextCount !== this.count) {
      this.count = nextCount
      this.positions = new Float32Array(this.count * 3)
      this.colors = new Float32Array(this.count * 4)
      this.sizes = new Float32Array(this.count)
      this.intensities = new Float32Array(this.count)
    }

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!
      const position = normalizePosition(point.position, this.space)
      const color = normalizeColor(point.color ?? this.defaultColor)
      const offset3 = index * 3
      const offset4 = index * 4
      this.positions[offset3] = position[0]
      this.positions[offset3 + 1] = position[1]
      this.positions[offset3 + 2] = position[2]
      this.colors[offset4] = color[0]
      this.colors[offset4 + 1] = color[1]
      this.colors[offset4 + 2] = color[2]
      this.colors[offset4 + 3] = color[3]
      this.sizes[index] = finitePositive(point.size, this.defaultSize)
      this.intensities[index] = finiteNonNegative(point.intensity, this.defaultIntensity)
    }

    this.pointVersion += 1
    return this
  }

  override clone(recursive = true): PointField {
    const points: PointFieldPoint[] = Array.from({ length: this.count }, (_, index) => ({
      position: [this.positions[index * 3]!, this.positions[index * 3 + 1]!, this.positions[index * 3 + 2]!],
      color: [this.colors[index * 4]!, this.colors[index * 4 + 1]!, this.colors[index * 4 + 2]!, this.colors[index * 4 + 3]!],
      size: this.sizes[index]!,
      intensity: this.intensities[index]!,
    }))
    const copy = new PointField({
      id: this.id,
      name: this.name,
      tags: [...this.tags],
      visible: this.visible,
      layerMask: this.layerMask,
      space: this.space,
      defaultColor: this.defaultColor,
      defaultSize: this.defaultSize,
      defaultIntensity: this.defaultIntensity,
      points,
    })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) for (const child of this.children) copy.add(child.clone(true))
    return copy
  }
}

function normalizePosition(value: readonly [number, number, number], space: PointFieldSpace): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new Error('PointField point positions must be finite vec3 values.')
  const x = Number(value[0]); const y = Number(value[1]); const z = Number(value[2])
  if (space !== 'directional') return [x, y, z]
  const length = Math.hypot(x, y, z)
  if (!(length > 0)) throw new Error('Directional PointField positions must be non-zero direction vectors.')
  return [x / length, y / length, z / length]
}

function normalizeColor(value: readonly number[]): readonly [number, number, number, number] {
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4) || !value.every(Number.isFinite)) throw new Error('PointField colors must be finite RGB or RGBA arrays.')
  return [clamp01(value[0]!), clamp01(value[1]!), clamp01(value[2]!), clamp01(value[3] ?? 1)]
}
function finitePositive(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback }
function finiteNonNegative(value: number | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }
