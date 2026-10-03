export interface RendererProceduralCloudState {
  enabled: boolean
  coverage: number
  density: number
  scale: number
  seed: number
  offset: readonly [number, number]
  evolution: number
  sunDirection: readonly [number, number, number]
  sunIntensity: number
}

export type RendererProceduralCloudInput = Partial<Omit<RendererProceduralCloudState, 'offset' | 'sunDirection'>> & {
  offset?: readonly [number, number]
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
    sunDirection: normalize3(finiteVec3(input.sunDirection, [0.35, 0.72, -0.6])),
    sunIntensity: Math.max(0, finite(input.sunIntensity, 8)),
  }
}

/**
 * Creates deterministic RGBA value-noise used by the renderer background cloud layer.
 * The four independent channels are intentionally domain-neutral; cloud shape comes from
 * how renderers combine them at multiple scales. The texture is repeat-safe when sampled
 * with repeat addressing and linear filtering, so runtime offsets can drift indefinitely.
 */
export function createProceduralCloudNoise(seed: number, size = 128): Uint8Array {
  const resolvedSize = Math.max(16, Math.min(512, Math.round(size)))
  const output = new Uint8Array(resolvedSize * resolvedSize * 4)
  const base = Math.trunc(finite(seed, 1) * 1_000_003)
  for (let y = 0; y < resolvedSize; y += 1) {
    for (let x = 0; x < resolvedSize; x += 1) {
      const target = (y * resolvedSize + x) * 4
      output[target] = hashByte(x, y, base + 101)
      output[target + 1] = hashByte(x, y, base + 211)
      output[target + 2] = hashByte(x, y, base + 307)
      output[target + 3] = hashByte(x, y, base + 401)
    }
  }
  return output
}

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
function normalize3(value: readonly [number, number, number]): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!(length > 0.000001)) return [0, 1, 0]
  return [value[0] / length, value[1] / length, value[2] / length]
}
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
