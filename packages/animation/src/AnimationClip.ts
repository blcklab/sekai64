import { ManagedResource } from '@sekai64-internal/core'

export type AnimationInterpolation = 'step' | 'linear'
export type AnimationTrackPath = 'translation' | 'rotation' | 'scale' | 'weights'

export interface AnimationTrackOptions {
  target: string
  path: AnimationTrackPath
  times: Float32Array
  values: Float32Array
  interpolation?: AnimationInterpolation
  valueSize?: number
}

export class AnimationTrack {
  readonly target: string
  readonly path: AnimationTrackPath
  readonly times: Float32Array
  readonly values: Float32Array
  readonly interpolation: AnimationInterpolation
  readonly valueSize: number

  constructor(options: AnimationTrackOptions) {
    if (!options.target.trim()) throw new Error('Animation track target cannot be empty.')
    if (options.times.length === 0) throw new Error('Animation track requires at least one keyframe.')
    for (let index = 1; index < options.times.length; index += 1) if ((options.times[index] ?? 0) < (options.times[index - 1] ?? 0)) throw new Error('Animation track times must be sorted.')
    const defaultSize = options.path === 'rotation' ? 4 : options.path === 'weights' ? Math.max(1, options.values.length / options.times.length) : 3
    const valueSize = options.valueSize ?? defaultSize
    if (!Number.isInteger(valueSize) || valueSize <= 0) throw new Error('Animation track valueSize must be a positive integer.')
    if (options.values.length !== options.times.length * valueSize) throw new Error(`Animation track values length must be ${options.times.length * valueSize}.`)
    this.target = options.target
    this.path = options.path
    this.times = options.times.slice()
    this.values = options.values.slice()
    this.interpolation = options.interpolation ?? 'linear'
    this.valueSize = valueSize
  }

  sample(time: number, target = new Float32Array(this.valueSize)): Float32Array {
    if (this.times.length === 1 || time <= (this.times[0] ?? 0)) return this.readValue(0, target)
    const last = this.times.length - 1
    if (time >= (this.times[last] ?? 0)) return this.readValue(last, target)
    let right = 1
    while (right < this.times.length && (this.times[right] ?? 0) < time) right += 1
    const left = Math.max(0, right - 1)
    if (this.interpolation === 'step') return this.readValue(left, target)
    const start = this.times[left] ?? 0
    const end = this.times[right] ?? start
    const alpha = end === start ? 0 : (time - start) / (end - start)
    if (this.path === 'rotation') return slerpValues(this.values, left * this.valueSize, right * this.valueSize, alpha, target)
    for (let component = 0; component < this.valueSize; component += 1) {
      const a = this.values[left * this.valueSize + component] ?? 0
      const b = this.values[right * this.valueSize + component] ?? a
      target[component] = a + (b - a) * alpha
    }
    return target
  }

  private readValue(index: number, target: Float32Array): Float32Array {
    target.set(this.values.subarray(index * this.valueSize, index * this.valueSize + this.valueSize))
    return target
  }
}

export interface AnimationMarker { name: string; time: number; data?: unknown }
export interface AnimationClipOptions { id: string; name?: string; tracks: readonly AnimationTrack[]; markers?: readonly AnimationMarker[]; duration?: number }

export class AnimationClip extends ManagedResource {
  readonly id: string
  readonly name: string
  readonly tracks: readonly AnimationTrack[]
  readonly markers: readonly AnimationMarker[]
  readonly duration: number

  constructor(options: AnimationClipOptions) {
    super(options.name ?? options.id)
    if (!options.id.trim()) throw new Error('Animation clip id cannot be empty.')
    this.id = options.id
    this.name = options.name ?? options.id
    this.tracks = [...options.tracks]
    this.markers = [...(options.markers ?? [])].sort((a, b) => a.time - b.time)
    const calculated = this.tracks.reduce((maximum, track) => Math.max(maximum, track.times[track.times.length - 1] ?? 0), 0)
    this.duration = Math.max(0, options.duration ?? calculated)
    for (const marker of this.markers) if (marker.time < 0 || marker.time > this.duration) throw new Error(`Animation marker ${marker.name} is outside clip duration.`)
  }

  protected release(): void {}
}

function slerpValues(values: Float32Array, aOffset: number, bOffset: number, alpha: number, target: Float32Array): Float32Array {
  let ax = values[aOffset] ?? 0, ay = values[aOffset + 1] ?? 0, az = values[aOffset + 2] ?? 0, aw = values[aOffset + 3] ?? 1
  let bx = values[bOffset] ?? 0, by = values[bOffset + 1] ?? 0, bz = values[bOffset + 2] ?? 0, bw = values[bOffset + 3] ?? 1
  let cosine = ax * bx + ay * by + az * bz + aw * bw
  if (cosine < 0) { cosine = -cosine; bx = -bx; by = -by; bz = -bz; bw = -bw }
  if (cosine > 0.9995) {
    ax += (bx - ax) * alpha; ay += (by - ay) * alpha; az += (bz - az) * alpha; aw += (bw - aw) * alpha
  } else {
    const theta = Math.acos(Math.max(-1, Math.min(1, cosine)))
    const sine = Math.sin(theta) || 1
    const left = Math.sin((1 - alpha) * theta) / sine
    const right = Math.sin(alpha * theta) / sine
    ax = ax * left + bx * right; ay = ay * left + by * right; az = az * left + bz * right; aw = aw * left + bw * right
  }
  const length = Math.hypot(ax, ay, az, aw) || 1
  target[0] = ax / length; target[1] = ay / length; target[2] = az / length; target[3] = aw / length
  return target
}
