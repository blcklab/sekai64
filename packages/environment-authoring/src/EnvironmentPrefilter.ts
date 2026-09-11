import { EnvironmentResource } from '@sekai64-internal/environment'
import type { RendererEnvironmentFormat, RendererEnvironmentLevel, RendererEnvironmentMap } from '@sekai64-internal/renderer'

export interface EnvironmentMipLevel { width: number; height: number; roughness: number; pixels: Float32Array }
export interface EnvironmentBrdfLut { width: number; height: number; pixels: Float32Array }
export interface PrefilteredEnvironment {
  sourceId: string
  diffuse: EnvironmentMipLevel
  specular: readonly EnvironmentMipLevel[]
  brdfLut: EnvironmentBrdfLut
}
export interface EnvironmentPrefilterOptions {
  diffuseWidth?: number
  specularWidth?: number
  levels?: number
  sampleCount?: number
  diffuseSampleCount?: number
  specularSampleCount?: number
  brdfSize?: number
  brdfSampleCount?: number
}

/**
 * Deterministic CPU reference implementation of glTF-style split-sum IBL.
 *
 * - Diffuse is cosine-convolved irradiance in linear HDR.
 * - Specular levels are GGX importance-sampled in linear HDR.
 * - The BRDF LUT stores the DFG scale/bias used by the split-sum approximation.
 *
 * Runtime GPU prefiltering can replace this implementation without changing the public contract.
 */
export function prefilterEnvironment(source: EnvironmentResource, options: EnvironmentPrefilterOptions = {}): PrefilteredEnvironment {
  if (source.disposed) throw new Error('Cannot prefilter a disposed environment resource.')
  const diffuseWidth = powerOfTwo(options.diffuseWidth ?? 32, 'diffuseWidth')
  const specularWidth = powerOfTwo(options.specularWidth ?? 128, 'specularWidth')
  const levels = Math.max(1, Math.min(9, Math.floor(options.levels ?? Math.log2(specularWidth) + 1)))
  const sharedSamples = Math.max(4, Math.min(512, Math.floor(options.sampleCount ?? 32)))
  const diffuseSamples = Math.max(4, Math.min(512, Math.floor(options.diffuseSampleCount ?? sharedSamples)))
  const specularSamples = Math.max(4, Math.min(512, Math.floor(options.specularSampleCount ?? sharedSamples)))
  const brdfSize = powerOfTwo(options.brdfSize ?? 64, 'brdfSize')
  const brdfSamples = Math.max(8, Math.min(1024, Math.floor(options.brdfSampleCount ?? Math.max(32, sharedSamples))))

  const diffuse = convolveDiffuse(source, diffuseWidth, Math.max(1, diffuseWidth >> 1), diffuseSamples)
  const specular: EnvironmentMipLevel[] = []
  for (let level = 0; level < levels; level += 1) {
    const roughness = levels === 1 ? 0 : level / (levels - 1)
    const width = Math.max(1, specularWidth >> level)
    const height = Math.max(1, width >> 1)
    const samples = Math.max(4, Math.round(specularSamples * (0.55 + roughness * 0.45)))
    specular.push(prefilterSpecular(source, width, height, roughness, samples))
  }
  const brdfLut = integrateBrdfLut(brdfSize, brdfSize, brdfSamples)
  return Object.freeze({ sourceId: source.id, diffuse, specular: Object.freeze(specular), brdfLut })
}

function convolveDiffuse(source: EnvironmentResource, width: number, height: number, sampleCount: number): EnvironmentMipLevel {
  const output = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const normal = directionFromUv((x + 0.5) / width, (y + 0.5) / height)
    const [tangent, bitangent] = tangentBasis(normal)
    let red = 0, green = 0, blue = 0
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const xi = hammersley(sample, sampleCount)
      const local = cosineSampleHemisphere(xi)
      const direction = normalize3(add3(add3(scale3(tangent, local[0]), scale3(bitangent, local[1])), scale3(normal, local[2])))
      const color = sampleEnvironmentDirection(source, direction)
      red += color[0]; green += color[1]; blue += color[2]
    }
    // Cosine-weighted sampling has pdf = cos(theta) / PI, so irradiance is PI * mean(L).
    const scale = Math.PI / sampleCount
    const index = (y * width + x) * 3
    output[index] = red * scale
    output[index + 1] = green * scale
    output[index + 2] = blue * scale
  }
  return Object.freeze({ width, height, roughness: 1, pixels: output })
}

function prefilterSpecular(source: EnvironmentResource, width: number, height: number, roughness: number, sampleCount: number): EnvironmentMipLevel {
  const output = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const reflection = directionFromUv((x + 0.5) / width, (y + 0.5) / height)
    const index = (y * width + x) * 3
    if (roughness <= 0.0001) {
      const color = sampleEnvironmentDirection(source, reflection)
      output[index] = color[0]; output[index + 1] = color[1]; output[index + 2] = color[2]
      continue
    }
    const [tangent, bitangent] = tangentBasis(reflection)
    let red = 0, green = 0, blue = 0, totalWeight = 0
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const xi = hammersley(sample, sampleCount)
      const localHalf = importanceSampleGgx(xi, roughness)
      const halfVector = normalize3(add3(add3(scale3(tangent, localHalf[0]), scale3(bitangent, localHalf[1])), scale3(reflection, localHalf[2])))
      const view = reflection
      const light = normalize3(sub3(scale3(halfVector, 2 * dot3(view, halfVector)), view))
      const ndotl = Math.max(dot3(reflection, light), 0)
      if (ndotl <= 0) continue
      const color = sampleEnvironmentDirection(source, light)
      red += color[0] * ndotl; green += color[1] * ndotl; blue += color[2] * ndotl; totalWeight += ndotl
    }
    const inverseWeight = 1 / Math.max(0.000001, totalWeight)
    output[index] = red * inverseWeight
    output[index + 1] = green * inverseWeight
    output[index + 2] = blue * inverseWeight
  }
  return Object.freeze({ width, height, roughness, pixels: output })
}

function integrateBrdfLut(width: number, height: number, sampleCount: number): EnvironmentBrdfLut {
  const output = new Float32Array(width * height * 4)
  const normal: Vec3 = [0, 0, 1]
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const ndotv = Math.max(0.0001, (x + 0.5) / width)
    const roughness = Math.max(0.001, (y + 0.5) / height)
    const view: Vec3 = [Math.sqrt(Math.max(0, 1 - ndotv * ndotv)), 0, ndotv]
    let scale = 0, bias = 0
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const halfVector = importanceSampleGgx(hammersley(sample, sampleCount), roughness)
      const light = normalize3(sub3(scale3(halfVector, 2 * dot3(view, halfVector)), view))
      const ndotl = Math.max(light[2], 0)
      const ndoth = Math.max(halfVector[2], 0)
      const vdoth = Math.max(dot3(view, halfVector), 0)
      if (ndotl <= 0 || ndoth <= 0 || vdoth <= 0) continue
      const geometry = geometrySmithIbl(ndotv, ndotl, roughness)
      const visibility = (geometry * vdoth) / Math.max(0.000001, ndoth * ndotv)
      const fresnel = Math.pow(1 - vdoth, 5)
      scale += (1 - fresnel) * visibility
      bias += fresnel * visibility
    }
    const index = (y * width + x) * 4
    output[index] = scale / sampleCount
    output[index + 1] = bias / sampleCount
    output[index + 2] = 0
    output[index + 3] = 1
  }
  return Object.freeze({ width, height, pixels: output })
}

function geometrySmithIbl(ndotv: number, ndotl: number, roughness: number): number {
  const k = (roughness * roughness) / 2
  const gv = ndotv / Math.max(0.000001, ndotv * (1 - k) + k)
  const gl = ndotl / Math.max(0.000001, ndotl * (1 - k) + k)
  return gv * gl
}

function cosineSampleHemisphere(xi: Vec2): Vec3 {
  const radius = Math.sqrt(xi[0])
  const phi = 2 * Math.PI * xi[1]
  return [radius * Math.cos(phi), radius * Math.sin(phi), Math.sqrt(Math.max(0, 1 - xi[0]))]
}

function importanceSampleGgx(xi: Vec2, roughness: number): Vec3 {
  const alpha = Math.max(0.0001, roughness * roughness)
  const alpha2 = alpha * alpha
  const phi = 2 * Math.PI * xi[0]
  const cosTheta = Math.sqrt(Math.max(0, (1 - xi[1]) / Math.max(0.000001, 1 + (alpha2 - 1) * xi[1])))
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
  return [Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta]
}

function sampleEnvironmentDirection(source: EnvironmentResource, direction: Vec3): Vec3 {
  const uv = uvFromDirection(direction)
  const u = uv[0] - Math.floor(uv[0])
  const v = clamp(uv[1], 0, 1)
  const x = u * (source.width - 1), y = v * (source.height - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = (x0 + 1) % source.width, y1 = Math.min(source.height - 1, y0 + 1)
  const tx = x - x0, ty = y - y0
  const result: Vec3 = [0, 0, 0]
  for (let channel = 0; channel < 3; channel += 1) {
    const a = source.pixels[(y0 * source.width + x0) * 3 + channel] ?? 0
    const b = source.pixels[(y0 * source.width + x1) * 3 + channel] ?? 0
    const c = source.pixels[(y1 * source.width + x0) * 3 + channel] ?? 0
    const d = source.pixels[(y1 * source.width + x1) * 3 + channel] ?? 0
    result[channel] = mix(mix(a, b, tx), mix(c, d, tx), ty)
  }
  return result
}

function directionFromUv(u: number, v: number): Vec3 {
  const phi = (u - 0.5) * 2 * Math.PI
  const theta = clamp(v, 0, 1) * Math.PI
  const sinTheta = Math.sin(theta)
  return [Math.cos(phi) * sinTheta, Math.cos(theta), Math.sin(phi) * sinTheta]
}
function uvFromDirection(direction: Vec3): Vec2 {
  const normalized = normalize3(direction)
  return [Math.atan2(normalized[2], normalized[0]) / (2 * Math.PI) + 0.5, Math.acos(clamp(normalized[1], -1, 1)) / Math.PI]
}
function tangentBasis(normal: Vec3): [Vec3, Vec3] {
  const up: Vec3 = Math.abs(normal[1]) < 0.999 ? [0, 1, 0] : [1, 0, 0]
  const tangent = normalize3(cross3(up, normal))
  return [tangent, cross3(normal, tangent)]
}

type Vec2 = [number, number]
type Vec3 = [number, number, number]
function add3(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function scale3(a: Vec3, scale: number): Vec3 { return [a[0] * scale, a[1] * scale, a[2] * scale] }
function dot3(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function cross3(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function normalize3(value: Vec3): Vec3 { const length = Math.hypot(value[0], value[1], value[2]); return length > 0.0000001 ? [value[0] / length, value[1] / length, value[2] / length] : [0, 1, 0] }
function hammersley(index: number, count: number): Vec2 { return [index / count, radicalInverse(index)] }
function radicalInverse(bits: number): number { bits = ((bits << 16) | (bits >>> 16)) >>> 0; bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0; bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0; bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0; bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0; return bits * 2.3283064365386963e-10 }
function powerOfTwo(value: number, name: string): number { if (!Number.isInteger(value) || value < 2 || value > 2048 || (value & (value - 1)) !== 0) throw new Error(`${name} must be a power of two between 2 and 2048.`); return value }
function mix(a: number, b: number, amount: number): number { return a + (b - a) * amount }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }

export interface PackPrefilteredEnvironmentOptions {
  /** Linear pre-exposure multiplier. HDR is never tone-mapped during packing. */
  exposure?: number
  intensity?: number
  rotation?: number
  label?: string
  /** Defaults to linear half-float HDR. `rgba8-srgb` is retained as a compatibility fallback. */
  format?: RendererEnvironmentFormat
}

/** Packs physically based prefilter results without destroying HDR range before lighting. */
export function packPrefilteredEnvironment(environment: PrefilteredEnvironment, options: PackPrefilteredEnvironmentOptions = {}): RendererEnvironmentMap {
  if (environment.specular.length === 0) throw new Error('A prefiltered environment must contain at least one specular level.')
  const exposure = Math.max(0, options.exposure ?? 1)
  const format = options.format ?? 'rgba16f-linear'
  const levels: RendererEnvironmentLevel[] = environment.specular.map(level => ({
    width: level.width,
    height: level.height,
    pixels: format === 'rgba16f-linear' ? linearRgbToRgbaFloat(level.pixels, exposure) : hdrToRgba8(level.pixels, exposure),
  }))
  const base = levels[0] as RendererEnvironmentLevel
  const diffuse: RendererEnvironmentLevel = {
    width: environment.diffuse.width,
    height: environment.diffuse.height,
    pixels: format === 'rgba16f-linear' ? linearRgbToRgbaFloat(environment.diffuse.pixels, exposure) : hdrToRgba8(environment.diffuse.pixels, exposure),
  }
  return {
    width: base.width,
    height: base.height,
    pixels: base.pixels,
    format,
    mipLevels: levels.slice(1),
    diffuse,
    ...(format === 'rgba16f-linear' ? { brdfLut: { width: environment.brdfLut.width, height: environment.brdfLut.height, pixels: environment.brdfLut.pixels.slice() } } : {}),
    intensity: options.intensity ?? 1,
    rotation: options.rotation ?? 0,
    label: options.label ?? `${environment.sourceId} GGX prefiltered`,
  }
}

function linearRgbToRgbaFloat(source: Float32Array, exposure: number): Float32Array {
  const output = new Float32Array((source.length / 3) * 4)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 3, targetIndex += 4) {
    output[targetIndex] = Math.max(0, (source[sourceIndex] ?? 0) * exposure)
    output[targetIndex + 1] = Math.max(0, (source[sourceIndex + 1] ?? 0) * exposure)
    output[targetIndex + 2] = Math.max(0, (source[sourceIndex + 2] ?? 0) * exposure)
    output[targetIndex + 3] = 1
  }
  return output
}
function hdrToRgba8(source: Float32Array, exposure: number): Uint8Array {
  const output = new Uint8Array((source.length / 3) * 4)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 3, targetIndex += 4) {
    output[targetIndex] = encodeSrgb(aces((source[sourceIndex] ?? 0) * exposure))
    output[targetIndex + 1] = encodeSrgb(aces((source[sourceIndex + 1] ?? 0) * exposure))
    output[targetIndex + 2] = encodeSrgb(aces((source[sourceIndex + 2] ?? 0) * exposure))
    output[targetIndex + 3] = 255
  }
  return output
}
function aces(value: number): number { const x = Math.max(0, value); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1) }
function encodeSrgb(value: number): number { const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055; return Math.round(clamp(encoded, 0, 1) * 255) }
