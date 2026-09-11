import { EnvironmentResource, type ToneMapping } from '@sekai64-internal/environment'

export interface ProceduralSkyOptions {
  id?: string
  width?: number
  height?: number
  zenithColor?: readonly [number, number, number]
  horizonColor?: readonly [number, number, number]
  groundColor?: readonly [number, number, number]
  sunColor?: readonly [number, number, number]
  sunDirection?: readonly [number, number, number]
  sunAngularRadius?: number
  sunIntensity?: number
  haze?: number
  cloudCoverage?: number
  cloudDensity?: number
  cloudScale?: number
  cloudSeed?: number
  intensity?: number
  exposure?: number
  toneMapping?: ToneMapping
  label?: string
}

/** Creates a deterministic HDR equirectangular sky suitable for backgrounds and lightweight IBL. */
export function createProceduralSky(options: ProceduralSkyOptions = {}): EnvironmentResource {
  const width = positiveInteger(options.width ?? 512, 'width')
  const height = positiveInteger(options.height ?? 256, 'height')
  const zenith = color(options.zenithColor ?? [0.075, 0.22, 0.58])
  const horizon = color(options.horizonColor ?? [0.85, 0.72, 0.62])
  const ground = color(options.groundColor ?? [0.045, 0.055, 0.045])
  const sun = color(options.sunColor ?? [1, 0.82, 0.58])
  const sunDirection = normalize(options.sunDirection ?? [0.35, 0.72, -0.6])
  const angularRadius = clamp(options.sunAngularRadius ?? 0.028, 0.002, 0.25)
  const sunIntensity = Math.max(0, options.sunIntensity ?? 8)
  const haze = clamp(options.haze ?? 0.22, 0, 1)
  const cloudCoverage = clamp(options.cloudCoverage ?? 0.18, 0, 1)
  const cloudDensity = Math.max(0, options.cloudDensity ?? 0.65)
  const cloudScale = Math.max(0.1, options.cloudScale ?? 3.5)
  const seed = options.cloudSeed ?? 1
  const pixels = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    const latitude = (0.5 - v) * Math.PI
    const cosLat = Math.cos(latitude)
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width
      const longitude = (u - 0.5) * Math.PI * 2
      const direction: [number, number, number] = [Math.sin(longitude) * cosLat, Math.sin(latitude), -Math.cos(longitude) * cosLat]
      const above = smoothstep(-0.08, 0.18, direction[1])
      const vertical = clamp(direction[1], 0, 1)
      const sky = mixColor(horizon, zenith, Math.pow(vertical, 0.48))
      const base = mixColor(ground, sky, above)
      const horizonGlow = Math.exp(-Math.abs(direction[1]) * (5 + haze * 18)) * haze
      base[0] += horizon[0] * horizonGlow; base[1] += horizon[1] * horizonGlow; base[2] += horizon[2] * horizonGlow
      const cosine = clamp(dot(direction, sunDirection), -1, 1)
      const angle = Math.acos(cosine)
      const disc = 1 - smoothstep(angularRadius * 0.72, angularRadius, angle)
      const halo = Math.pow(Math.max(0, cosine), 256 / Math.max(0.05, haze + 0.05)) * (0.25 + haze * 2)
      base[0] += sun[0] * sunIntensity * (disc + halo); base[1] += sun[1] * sunIntensity * (disc + halo); base[2] += sun[2] * sunIntensity * (disc + halo)
      if (direction[1] > 0 && cloudCoverage > 0) {
        const cloud = fbm(direction[0] * cloudScale + seed * 17.3, direction[2] * cloudScale - seed * 9.1, seed)
        const threshold = 1 - cloudCoverage
        const amount = smoothstep(threshold, Math.min(1, threshold + 0.22), cloud) * cloudDensity * Math.pow(vertical, 0.3)
        const light = 0.7 + 0.3 * Math.max(0, dot(direction, sunDirection))
        base[0] = mix(base[0], 1.25 * light, amount); base[1] = mix(base[1], 1.28 * light, amount); base[2] = mix(base[2], 1.35 * light, amount)
      }
      const index = (y * width + x) * 3
      pixels[index] = Math.max(0, base[0]); pixels[index + 1] = Math.max(0, base[1]); pixels[index + 2] = Math.max(0, base[2])
    }
  }
  return new EnvironmentResource({ id: options.id ?? 'procedural-sky', width, height, pixels, intensity: options.intensity ?? 1, exposure: options.exposure ?? 1, toneMapping: options.toneMapping ?? 'aces', label: options.label ?? 'Procedural sky' })
}

function fbm(x: number, y: number, seed: number): number { let value = 0, amplitude = 0.5, frequency = 1, total = 0; for (let octave = 0; octave < 5; octave += 1) { value += noise(x * frequency, y * frequency, seed + octave * 31) * amplitude; total += amplitude; amplitude *= 0.5; frequency *= 2.03 } return value / total }
function noise(x: number, y: number, seed: number): number { const ix = Math.floor(x), iy = Math.floor(y), fx = smoothFraction(x - ix), fy = smoothFraction(y - iy); const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed); return mix(mix(a, b, fx), mix(c, d, fx), fy) }
function hash(x: number, y: number, seed: number): number { const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123; return value - Math.floor(value) }
function smoothFraction(value: number): number { return value * value * (3 - 2 * value) }
function normalize(value: readonly [number, number, number]): [number, number, number] { const length = Math.hypot(value[0], value[1], value[2]); if (length < 0.000001) return [0, 1, 0]; return [value[0] / length, value[1] / length, value[2] / length] }
function color(value: readonly [number, number, number]): [number, number, number] { if (value.some(channel => !Number.isFinite(channel) || channel < 0)) throw new Error('Procedural sky colors must contain finite non-negative values.'); return [...value] as [number, number, number] }
function mixColor(a: readonly [number, number, number], b: readonly [number, number, number], amount: number): [number, number, number] { return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)] }
function dot(a: readonly number[], b: readonly number[]): number { return (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0) }
function smoothstep(a: number, b: number, value: number): number { const t = clamp((value - a) / Math.max(0.000001, b - a), 0, 1); return t * t * (3 - 2 * t) }
function mix(a: number, b: number, amount: number): number { return a + (b - a) * amount }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
function positiveInteger(value: number, name: string): number { if (!Number.isInteger(value) || value < 2 || value > 4096) throw new Error(`Procedural sky ${name} must be an integer between 2 and 4096.`); return value }
