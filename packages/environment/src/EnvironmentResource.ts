import { ManagedResource } from '@sekai64-internal/core'
import { Color } from '@sekai64-internal/math'

export type ToneMapping = 'none' | 'reinhard' | 'aces'
export interface EnvironmentResourceOptions { id: string; width: number; height: number; pixels: Float32Array; intensity?: number; exposure?: number; toneMapping?: ToneMapping; label?: string }

export class EnvironmentResource extends ManagedResource {
  readonly id: string
  readonly width: number
  readonly height: number
  readonly pixels: Float32Array
  intensity: number
  exposure: number
  toneMapping: ToneMapping
  readonly average = new Color()
  readonly skyAverage = new Color()
  readonly groundAverage = new Color()

  constructor(options: EnvironmentResourceOptions) {
    super(options.label ?? options.id)
    if (!options.id.trim()) throw new Error('Environment resource id cannot be empty.')
    if (!Number.isInteger(options.width) || options.width <= 0 || !Number.isInteger(options.height) || options.height <= 0) throw new Error('Environment dimensions must be positive integers.')
    if (options.pixels.length !== options.width * options.height * 3) throw new Error('Environment pixels must contain RGB triplets.')
    this.id = options.id; this.width = options.width; this.height = options.height; this.pixels = options.pixels.slice()
    this.intensity = Math.max(0, options.intensity ?? 1); this.exposure = options.exposure ?? 1; this.toneMapping = options.toneMapping ?? 'aces'
    this.recalculateAverage()
  }

  recalculateAverage(): this {
    let r = 0, g = 0, b = 0
    let skyR = 0, skyG = 0, skyB = 0, skyCount = 0
    let groundR = 0, groundG = 0, groundB = 0, groundCount = 0
    const count = this.width * this.height
    for (let pixel = 0; pixel < count; pixel += 1) {
      const index = pixel * 3
      const red = this.pixels[index] ?? 0
      const green = this.pixels[index + 1] ?? 0
      const blue = this.pixels[index + 2] ?? 0
      r += red; g += green; b += blue
      const row = Math.floor(pixel / this.width)
      if (row < this.height * 0.5) { skyR += red; skyG += green; skyB += blue; skyCount += 1 }
      else { groundR += red; groundG += green; groundB += blue; groundCount += 1 }
    }
    this.average.setRGBA(r / count, g / count, b / count, 1)
    this.skyAverage.setRGBA(skyR / Math.max(1, skyCount), skyG / Math.max(1, skyCount), skyB / Math.max(1, skyCount), 1)
    this.groundAverage.setRGBA(groundR / Math.max(1, groundCount), groundG / Math.max(1, groundCount), groundB / Math.max(1, groundCount), 1)
    return this
  }

  toLdr(): Uint8ClampedArray {
    this.assertAlive()
    const output = new Uint8ClampedArray(this.width * this.height * 4)
    for (let pixel = 0; pixel < this.width * this.height; pixel += 1) {
      const source = pixel * 3, target = pixel * 4
      output[target] = encodeSrgb(toneMap((this.pixels[source] ?? 0) * this.exposure * this.intensity, this.toneMapping))
      output[target + 1] = encodeSrgb(toneMap((this.pixels[source + 1] ?? 0) * this.exposure * this.intensity, this.toneMapping))
      output[target + 2] = encodeSrgb(toneMap((this.pixels[source + 2] ?? 0) * this.exposure * this.intensity, this.toneMapping))
      output[target + 3] = 255
    }
    return output
  }

  protected release(): void { this.pixels.fill(0) }
}

export function toneMap(value: number, mode: ToneMapping): number {
  const x = Math.max(0, value)
  if (mode === 'none') return x
  if (mode === 'reinhard') return x / (1 + x)
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
  return (x * (a * x + b)) / (x * (c * x + d) + e)
}
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }
function encodeSrgb(value: number): number {
  const linear = clamp01(value)
  const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
  return Math.round(clamp01(encoded) * 255)
}
