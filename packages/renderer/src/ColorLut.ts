export interface RendererColorLut {
  /** Edge length of the cubic LUT. Production LUTs commonly use 16, 32, or 64. */
  size: number
  /** RGB triplets ordered with red changing fastest, then green, then blue. */
  data: Float32Array
  label?: string
}

export interface ParsedCubeLut {
  lut: RendererColorLut
  domainMin: readonly [number, number, number]
  domainMax: readonly [number, number, number]
}

export function createIdentityColorLut(size = 16, label = 'Identity'): RendererColorLut {
  validateLutSize(size)
  const data = new Float32Array(size * size * size * 3)
  let offset = 0
  const denominator = Math.max(1, size - 1)
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        data[offset++] = red / denominator
        data[offset++] = green / denominator
        data[offset++] = blue / denominator
      }
    }
  }
  return { size, data, label }
}

export function parseCubeLut(source: string, label?: string): ParsedCubeLut {
  let size = 0
  let title = label
  let domainMin: [number, number, number] = [0, 0, 0]
  let domainMax: [number, number, number] = [1, 1, 1]
  const values: number[] = []
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*/u, '').trim()
    if (!line) continue
    const [keyword, ...parts] = line.split(/\s+/u)
    if (keyword === 'TITLE') { title ??= parts.join(' ').replace(/^"|"$/gu, ''); continue }
    if (keyword === 'LUT_3D_SIZE') { size = Number(parts[0]); continue }
    if (keyword === 'DOMAIN_MIN') { domainMin = parseTriplet(parts, 'DOMAIN_MIN'); continue }
    if (keyword === 'DOMAIN_MAX') { domainMax = parseTriplet(parts, 'DOMAIN_MAX'); continue }
    if (keyword?.startsWith('LUT_')) throw new Error(`Unsupported .cube directive: ${keyword}`)
    const triplet = parseTriplet([keyword ?? '', ...parts], 'LUT row')
    values.push(...triplet)
  }
  validateLutSize(size)
  const expected = size * size * size * 3
  if (values.length !== expected) throw new Error(`The .cube LUT contains ${values.length / 3} entries; expected ${expected / 3}.`)
  for (let channel = 0; channel < 3; channel += 1) if (!(domainMax[channel]! > domainMin[channel]!)) throw new Error('LUT DOMAIN_MAX must be greater than DOMAIN_MIN on every channel.')
  return { lut: { size, data: Float32Array.from(values), ...(title ? { label: title } : {}) }, domainMin, domainMax }
}

export function sampleColorLut(lut: RendererColorLut, color: readonly [number, number, number], intensity = 1): [number, number, number] {
  validateColorLut(lut)
  const amount = clamp(intensity, 0, 1)
  const maximum = lut.size - 1
  const x = clamp(color[0], 0, 1) * maximum
  const y = clamp(color[1], 0, 1) * maximum
  const z = clamp(color[2], 0, 1) * maximum
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z)
  const x1 = Math.min(maximum, x0 + 1), y1 = Math.min(maximum, y0 + 1), z1 = Math.min(maximum, z0 + 1)
  const tx = x - x0, ty = y - y0, tz = z - z0
  const result: [number, number, number] = [0, 0, 0]
  for (let channel = 0; channel < 3; channel += 1) {
    const c000 = component(lut, x0, y0, z0, channel), c100 = component(lut, x1, y0, z0, channel)
    const c010 = component(lut, x0, y1, z0, channel), c110 = component(lut, x1, y1, z0, channel)
    const c001 = component(lut, x0, y0, z1, channel), c101 = component(lut, x1, y0, z1, channel)
    const c011 = component(lut, x0, y1, z1, channel), c111 = component(lut, x1, y1, z1, channel)
    const c00 = mix(c000, c100, tx), c10 = mix(c010, c110, tx)
    const c01 = mix(c001, c101, tx), c11 = mix(c011, c111, tx)
    const graded = mix(mix(c00, c10, ty), mix(c01, c11, ty), tz)
    result[channel] = mix(color[channel]!, graded, amount)
  }
  return result
}

/** Packs a cubic LUT into a portable 2D strip: width=size*size, height=size. */
export function packColorLutStrip(lut: RendererColorLut): { width: number; height: number; pixels: Uint8Array } {
  validateColorLut(lut)
  const width = lut.size * lut.size, height = lut.size
  const pixels = new Uint8Array(width * height * 4)
  for (let blue = 0; blue < lut.size; blue += 1) {
    for (let green = 0; green < lut.size; green += 1) {
      for (let red = 0; red < lut.size; red += 1) {
        const source = ((blue * lut.size + green) * lut.size + red) * 3
        const x = blue * lut.size + red, y = green
        const target = (y * width + x) * 4
        pixels[target] = Math.round(clamp(lut.data[source] ?? 0, 0, 1) * 255)
        pixels[target + 1] = Math.round(clamp(lut.data[source + 1] ?? 0, 0, 1) * 255)
        pixels[target + 2] = Math.round(clamp(lut.data[source + 2] ?? 0, 0, 1) * 255)
        pixels[target + 3] = 255
      }
    }
  }
  return { width, height, pixels }
}

export function validateColorLut(lut: RendererColorLut): void {
  validateLutSize(lut.size)
  if (lut.data.length !== lut.size * lut.size * lut.size * 3) throw new Error('Color LUT data length does not match its cubic size.')
}

function component(lut: RendererColorLut, x: number, y: number, z: number, channel: number): number { return lut.data[((z * lut.size + y) * lut.size + x) * 3 + channel] ?? 0 }
function parseTriplet(parts: readonly string[], context: string): [number, number, number] { const values = parts.slice(0, 3).map(Number); if (values.length !== 3 || values.some(value => !Number.isFinite(value))) throw new Error(`${context} must contain three finite numbers.`); return values as [number, number, number] }
function validateLutSize(size: number): void { if (!Number.isInteger(size) || size < 2 || size > 64) throw new Error('Color LUT size must be an integer between 2 and 64.') }
function mix(a: number, b: number, amount: number): number { return a + (b - a) * amount }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
