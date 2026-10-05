export interface RendererProceduralCloudState {
  enabled: boolean
  coverage: number
  density: number
  scale: number
  seed: number
  offset: readonly [number, number]
  evolution: number
  detailOffset: readonly [number, number]
  detailEvolution: number
  macroScale: number
  detailScale: number
  detailStrength: number
  edgeSoftness: number
  warpStrength: number
  horizonVisibility: number
  horizonSoftness: number
  shadowStrength: number
  highlightStrength: number
  silverLiningStrength: number
  ambientColor: readonly [number, number, number]
  shadowColor: readonly [number, number, number]
  lightColor: readonly [number, number, number]
  sunDirection: readonly [number, number, number]
  sunIntensity: number
}

export type RendererProceduralCloudInput = Partial<Omit<RendererProceduralCloudState, 'offset' | 'detailOffset' | 'ambientColor' | 'shadowColor' | 'lightColor' | 'sunDirection'>> & {
  offset?: readonly [number, number]
  detailOffset?: readonly [number, number]
  ambientColor?: readonly [number, number, number]
  shadowColor?: readonly [number, number, number]
  lightColor?: readonly [number, number, number]
  sunDirection?: readonly [number, number, number]
}

export function resolveProceduralCloudState(input: RendererProceduralCloudInput = {}): RendererProceduralCloudState {
  return {
    enabled: input.enabled ?? false,
    coverage: clamp(input.coverage ?? 0.18, 0, 1),
    density: Math.max(0, finite(input.density, 0.65)),
    scale: Math.max(0.1, finite(input.scale, 3.5)),
    seed: finite(input.seed, 1),
    offset: finiteVec2(input.offset, [0, 0]),
    evolution: finite(input.evolution, 0),
    detailOffset: finiteVec2(input.detailOffset, input.offset ?? [0, 0]),
    detailEvolution: finite(input.detailEvolution, input.evolution ?? 0),
    macroScale: clamp(finite(input.macroScale, 1), 0.2, 4),
    detailScale: clamp(finite(input.detailScale, 1), 0.2, 4),
    detailStrength: clamp(finite(input.detailStrength, 0.1), 0, 0.5),
    edgeSoftness: clamp(finite(input.edgeSoftness, 0.09), 0.01, 0.3),
    warpStrength: clamp(finite(input.warpStrength, 0.16), 0, 0.6),
    horizonVisibility: clamp(finite(input.horizonVisibility, 0.62), 0, 1),
    horizonSoftness: clamp(finite(input.horizonSoftness, 0.18), 0.01, 0.6),
    shadowStrength: clamp(finite(input.shadowStrength, 0.24), 0, 1),
    highlightStrength: clamp(finite(input.highlightStrength, 0.58), 0, 1.5),
    silverLiningStrength: clamp(finite(input.silverLiningStrength, 0.08), 0, 0.5),
    ambientColor: clampVec3(finiteVec3(input.ambientColor, [0.86, 0.9, 0.98]), 0, 4),
    shadowColor: clampVec3(finiteVec3(input.shadowColor, [0.68, 0.74, 0.86]), 0, 4),
    lightColor: clampVec3(finiteVec3(input.lightColor, [1.08, 1.03, 0.96]), 0, 4),
    sunDirection: normalize3(finiteVec3(input.sunDirection, [0.35, 0.72, -0.6])),
    sunIntensity: Math.max(0, finite(input.sunIntensity, 8)),
  }
}

/**
 * Creates deterministic, periodic RGBA value-noise used by the renderer background cloud layer.
 * Each channel has a deliberately different coarse lattice frequency so the renderer receives
 * spatially coherent macro/medium/detail/warp fields instead of raw per-texel randomness.
 * The texture is repeat-safe, so runtime offsets can drift indefinitely without visible seams.
 */
export function createProceduralCloudNoise(seed: number, size = 128): Uint8Array {
  const resolvedSize = Math.max(16, Math.min(512, Math.round(size)))
  const output = new Uint8Array(resolvedSize * resolvedSize * 4)
  const base = Math.trunc(finite(seed, 1) * 1_000_003)
  const cells = [4, 8, 16, 6] as const
  const offsets = [101, 211, 307, 401] as const
  for (let y = 0; y < resolvedSize; y += 1) {
    const v = y / resolvedSize
    for (let x = 0; x < resolvedSize; x += 1) {
      const u = x / resolvedSize
      const target = (y * resolvedSize + x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        output[target + channel] = Math.round(periodicValueNoise(u, v, cells[channel]!, base + offsets[channel]!) * 255)
      }
    }
  }
  return output
}

function periodicValueNoise(u: number, v: number, cells: number, seed: number): number {
  const gx = u * cells
  const gy = v * cells
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = fade(gx - x0)
  const ty = fade(gy - y0)
  const sample = (x: number, y: number): number => hashByte(mod(x, cells), mod(y, cells), seed) / 255
  const top = mix(sample(x0, y0), sample(x0 + 1, y0), tx)
  const bottom = mix(sample(x0, y0 + 1), sample(x0 + 1, y0 + 1), tx)
  return mix(top, bottom, ty)
}

function fade(value: number): number { return value * value * (3 - 2 * value) }
function mix(a: number, b: number, t: number): number { return a + (b - a) * t }
function mod(value: number, modulus: number): number { return ((value % modulus) + modulus) % modulus }

function hashByte(x: number, y: number, seed: number): number {
  let value = (Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, 0x119de1f3) ^ seed) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return value & 0xff
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function finiteVec2(value: unknown, fallback: readonly [number, number]): readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? [Number(value[0]), Number(value[1])]
    : fallback
}
function finiteVec3(value: unknown, fallback: readonly [number, number, number]): readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? [Number(value[0]), Number(value[1]), Number(value[2])]
    : fallback
}
function clampVec3(value: readonly [number, number, number], minimum: number, maximum: number): readonly [number, number, number] {
  return [clamp(value[0], minimum, maximum), clamp(value[1], minimum, maximum), clamp(value[2], minimum, maximum)]
}
function normalize3(value: readonly [number, number, number]): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!(length > 0.000001)) return [0, 1, 0]
  return [value[0] / length, value[1] / length, value[2] / length]
}
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
