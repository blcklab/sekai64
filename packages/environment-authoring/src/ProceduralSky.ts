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
  starDensity?: number
  starIntensity?: number
  starBrightnessVariation?: number
  starSizeVariation?: number
  starColorTemperatureVariation?: number
  starSeed?: number
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
  const starDensity = clamp(options.starDensity ?? 0, 0, 1)
  const starIntensity = Math.max(0, options.starIntensity ?? 3.2)
  const starBrightnessVariation = clamp(options.starBrightnessVariation ?? 0.65, 0, 1)
  const starSizeVariation = clamp(options.starSizeVariation ?? 0.55, 0, 1)
  const starColorTemperatureVariation = clamp(options.starColorTemperatureVariation ?? 0.35, 0, 1)
  const starSeed = options.starSeed ?? seed
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
        const cloud = sampleCloudLayer(direction, cloudScale, seed, cloudCoverage, cloudDensity, sunDirection, sunIntensity)
        base[0] = mix(base[0], cloud.color[0], cloud.amount)
        base[1] = mix(base[1], cloud.color[1], cloud.amount)
        base[2] = mix(base[2], cloud.color[2], cloud.amount)
      }
      const index = (y * width + x) * 3
      pixels[index] = Math.max(0, base[0]); pixels[index + 1] = Math.max(0, base[1]); pixels[index + 2] = Math.max(0, base[2])
    }
  }
  if (starDensity > 0 && starIntensity > 0) addStars(pixels, width, height, { density: starDensity, intensity: starIntensity, brightnessVariation: starBrightnessVariation, sizeVariation: starSizeVariation, colorTemperatureVariation: starColorTemperatureVariation, seed: starSeed })
  return new EnvironmentResource({ id: options.id ?? 'procedural-sky', width, height, pixels, intensity: options.intensity ?? 1, exposure: options.exposure ?? 1, toneMapping: options.toneMapping ?? 'aces', label: options.label ?? 'Procedural sky' })
}


interface CloudLayerSample { amount: number; color: [number, number, number] }

/**
 * Samples the existing procedural sky cloud layer with multi-scale structure and
 * a light-weight pseudo-normal. The implementation stays entirely inside the
 * environment authoring resource: no cloud nodes, render pass, or runtime
 * simulation is introduced.
 */
function sampleCloudLayer(
  direction: readonly [number, number, number],
  cloudScale: number,
  seed: number,
  coverage: number,
  density: number,
  sunDirection: readonly [number, number, number],
  sunIntensity: number,
): CloudLayerSample {
  const vertical = clamp(direction[1], 0, 1)
  const perspective = 0.72 + 0.38 / Math.max(0.22, vertical + 0.18)
  const x = direction[0] * cloudScale * perspective + seed * 3.17
  const z = direction[2] * cloudScale * perspective - seed * 1.91
  const field = cloudField(x, z, seed)
  const threshold = mix(0.79, 0.37, coverage)
  const body = smoothstep(threshold - 0.045, threshold + 0.12, field)
  const horizonFade = smoothstep(0.015, 0.14, vertical)
  const amount = clamp(body * density * horizonFade, 0, 1)
  if (amount <= 0.0001) return { amount: 0, color: [0, 0, 0] }

  const epsilon = 0.055
  const gradientX = cloudField(x + epsilon, z, seed) - cloudField(x - epsilon, z, seed)
  const gradientZ = cloudField(x, z + epsilon, seed) - cloudField(x, z - epsilon, seed)
  const pseudoNormal = normalize([-gradientX * 4.6, 1, -gradientZ * 4.6])
  const diffuse = clamp(dot(pseudoNormal, sunDirection), 0, 1)
  const sunFacing = clamp(dot(direction, sunDirection), 0, 1)
  const interior = smoothstep(threshold + 0.035, threshold + 0.2, field)

  const coolShadow: [number, number, number] = [0.64, 0.72, 0.92]
  const warmLight: [number, number, number] = [1.34, 1.22, 1.08]
  const ambientCloud: [number, number, number] = [0.9, 0.96, 1.08]
  const sunStrength = clamp(sunIntensity / 8, 0, 1)
  const lightMix = 0.1 + diffuse * 0.9 * sunStrength
  const lit = mixColor(coolShadow, warmLight, lightMix)
  const cloudColor = mixColor(ambientCloud, lit, 0.82)
  const silverLining = (1 - interior) * Math.pow(sunFacing, 5) * 0.26 * sunStrength
  const baseShade = 1 - interior * (0.13 + (1 - vertical) * 0.11)
  cloudColor[0] = cloudColor[0] * baseShade + silverLining
  cloudColor[1] = cloudColor[1] * baseShade + silverLining * 0.92
  cloudColor[2] = cloudColor[2] * baseShade + silverLining * 0.72
  return { amount, color: cloudColor }
}

function cloudField(x: number, z: number, seed: number): number {
  const large = fbm(x * 0.36, z * 0.36, seed + 101)
  const medium = fbm(x * 0.92 + 7.3, z * 0.92 - 4.1, seed + 211)
  const small = fbm(x * 2.35 - 11.7, z * 2.35 + 6.8, seed + 307)
  const erosion = Math.abs(small * 2 - 1)
  return clamp(large * 0.52 + medium * 0.36 + small * 0.18 - erosion * 0.06, 0, 1)
}

interface StarFieldOptions { density: number; intensity: number; brightnessVariation: number; sizeVariation: number; colorTemperatureVariation: number; seed: number }

function addStars(pixels: Float32Array, width: number, height: number, options: StarFieldOptions): void {
  const count = Math.min(12000, Math.max(0, Math.round(options.density * width * height / 96)))
  const random = createRandom(options.seed)
  for (let index = 0; index < count; index += 1) {
    const y = random()
    const longitude = random() * Math.PI * 2 - Math.PI
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const direction: [number, number, number] = [Math.sin(longitude) * radial, y, -Math.cos(longitude) * radial]
    const u = (Math.atan2(direction[0], -direction[2]) / (Math.PI * 2) + 0.5 + 1) % 1
    const v = 0.5 - Math.asin(clamp(direction[1], -1, 1)) / Math.PI
    const centerX = u * width - 0.5
    const centerY = v * height - 0.5
    const rareBright = Math.pow(random(), 4)
    const brightness = options.intensity * mix(1 - options.brightnessVariation * 0.55, 1 + options.brightnessVariation * 4.5, rareBright)
    const radius = 0.58 + options.sizeVariation * (0.35 + rareBright * 0.95)
    const temperature = (random() * 2 - 1) * options.colorTemperatureVariation
    const tint = temperature < 0 ? mixColor([1, 1, 1], [1, 0.72, 0.48], -temperature) : mixColor([1, 1, 1], [0.62, 0.78, 1], temperature)
    const reach = Math.max(1, Math.ceil(radius * 1.6))
    for (let oy = -reach; oy <= reach; oy += 1) {
      const py = Math.round(centerY + oy)
      if (py < 0 || py >= Math.ceil(height * 0.5)) continue
      for (let ox = -reach; ox <= reach; ox += 1) {
        const pxRaw = Math.round(centerX + ox)
        const px = ((pxRaw % width) + width) % width
        const dx = pxRaw - centerX, dy = py - centerY
        const distance2 = dx * dx + dy * dy
        const sigma = Math.max(0.42, radius * 0.62)
        const weight = Math.exp(-distance2 / (2 * sigma * sigma))
        if (weight < 0.035) continue
        const target = (py * width + px) * 3
        pixels[target] = (pixels[target] ?? 0) + tint[0] * brightness * weight
        pixels[target + 1] = (pixels[target + 1] ?? 0) + tint[1] * brightness * weight
        pixels[target + 2] = (pixels[target + 2] ?? 0) + tint[2] * brightness * weight
      }
    }
  }
}

function createRandom(seed: number): () => number {
  let state = (Math.floor(seed * 1000003) ^ 0x9e3779b9) >>> 0
  return () => { state = (state + 0x6d2b79f5) >>> 0; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296 }
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
