export type ShadowFilterMode = 'hard' | 'pcf3' | 'pcf5' | 'poisson'
export interface ShadowFilterSample { x: number; y: number; weight: number }
export interface CascadeBlend { primary: number; secondary: number; blend: number }

const POISSON = Object.freeze([
  [-0.613392, 0.617481], [0.170019, -0.040254], [-0.299417, 0.791925], [0.645680, 0.493210],
  [-0.651784, 0.717887], [0.421003, 0.027070], [-0.817194, -0.271096], [-0.705374, -0.668203],
  [0.977050, -0.108615], [0.063326, 0.142369], [0.203528, 0.214331], [-0.667531, 0.326090],
  [-0.098422, -0.295755], [-0.885922, 0.215369], [0.566637, 0.605213], [0.039766, -0.396100],
] as const)

export function createShadowFilterKernel(mode: ShadowFilterMode, radius = 1): readonly ShadowFilterSample[] {
  const scale = Math.max(0, radius)
  if (mode === 'hard') return Object.freeze([{ x: 0, y: 0, weight: 1 }])
  if (mode === 'poisson') return Object.freeze(POISSON.map(([x, y]) => Object.freeze({ x: x * scale, y: y * scale, weight: 1 / POISSON.length })))
  const side = mode === 'pcf5' ? 5 : 3
  const half = (side - 1) / 2
  const samples: ShadowFilterSample[] = []
  let total = 0
  for (let y = -half; y <= half; y += 1) for (let x = -half; x <= half; x += 1) {
    const weight = (half + 1 - Math.abs(x)) * (half + 1 - Math.abs(y))
    samples.push({ x: x * scale, y: y * scale, weight }); total += weight
  }
  return Object.freeze(samples.map(sample => Object.freeze({ ...sample, weight: sample.weight / total })))
}

export function selectShadowCascade(viewDepth: number, splits: readonly number[], blendFraction = 0.12): CascadeBlend {
  if (splits.length === 0) return { primary: 0, secondary: 0, blend: 0 }
  const depth = Math.max(0, viewDepth)
  let primary = splits.findIndex(split => depth <= split)
  if (primary < 0) primary = splits.length - 1
  const previous = primary === 0 ? 0 : splits[primary - 1] ?? 0
  const end = splits[primary] ?? previous
  const width = Math.max(0.0001, end - previous)
  const blendStart = end - width * clamp(blendFraction, 0, 0.49)
  if (primary >= splits.length - 1 || depth <= blendStart) return { primary, secondary: primary, blend: 0 }
  return { primary, secondary: primary + 1, blend: smoothstep(blendStart, end, depth) }
}

export function shadowDistanceFade(viewDepth: number, maximumDistance: number, fadeFraction = 0.12): number {
  const maximum = Math.max(0.0001, maximumDistance)
  const start = maximum * (1 - clamp(fadeFraction, 0, 0.9))
  return 1 - smoothstep(start, maximum, Math.max(0, viewDepth))
}

function smoothstep(edge0: number, edge1: number, value: number): number { const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1); return t * t * (3 - 2 * t) }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
