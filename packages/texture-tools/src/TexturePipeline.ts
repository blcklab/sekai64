import type { TextureDataFormat, TextureDataSource, TextureMipLevel } from '@sekai64-internal/materials'

export interface DecodedTexturePayload {
  width: number
  height: number
  data: Uint8Array | Uint8ClampedArray
  format?: TextureDataFormat
  mipLevels?: readonly TextureMipLevel[]
  compressed?: boolean
  metadata?: Readonly<Record<string, unknown>>
}

export interface TextureDecoderRequest {
  format: string
  data: ArrayBuffer
  colorSpace?: 'srgb' | 'linear'
  signal?: AbortSignal
}

export interface TextureDecoderAdapter {
  readonly id: string
  readonly formats: readonly string[]
  decode(request: TextureDecoderRequest): Promise<DecodedTexturePayload>
  dispose?(): void | Promise<void>
}

/** Explicit optional-decoder registry for KTX2/Basis and future GPU texture containers. */
export class TextureDecoderRegistry {
  private readonly adapters = new Map<string, TextureDecoderAdapter>()
  private readonly formatOwners = new Map<string, string>()
  private disposed = false

  register(adapter: TextureDecoderAdapter): () => void {
    this.assertAlive()
    if (!adapter.id.trim()) throw new Error('Texture decoder adapter id cannot be empty.')
    if (this.adapters.has(adapter.id)) throw new Error(`Texture decoder adapter is already registered: ${adapter.id}`)
    const formats = [...new Set(adapter.formats.map(normalizeFormat).filter(Boolean))]
    if (formats.length === 0) throw new Error(`Texture decoder ${adapter.id} requires at least one format.`)
    for (const format of formats) if (this.formatOwners.has(format)) throw new Error(`Texture format ${format} is already owned by ${this.formatOwners.get(format)}.`)
    this.adapters.set(adapter.id, adapter)
    for (const format of formats) this.formatOwners.set(format, adapter.id)
    let active = true
    return () => { if (!active) return; active = false; this.adapters.delete(adapter.id); for (const format of formats) if (this.formatOwners.get(format) === adapter.id) this.formatOwners.delete(format) }
  }

  supports(format: string): boolean { return this.formatOwners.has(normalizeFormat(format)) }
  list(): Readonly<Record<string, string>> { return Object.freeze(Object.fromEntries([...this.formatOwners].sort())) }

  async decode(request: TextureDecoderRequest): Promise<TextureDataSource> {
    this.assertAlive(); throwIfAborted(request.signal)
    const format = normalizeFormat(request.format), owner = this.formatOwners.get(format), adapter = owner ? this.adapters.get(owner) : undefined
    if (!adapter) throw new Error(`No texture decoder is registered for ${format}. Install an explicit KTX2/Basis or container adapter.`)
    const payload = await adapter.decode({ ...request, format })
    throwIfAborted(request.signal)
    return toTextureDataSource(payload, request.colorSpace)
  }

  async disposeAsync(): Promise<void> { if (this.disposed) return; this.disposed = true; const adapters = [...this.adapters.values()].reverse(); this.adapters.clear(); this.formatOwners.clear(); for (const adapter of adapters) await adapter.dispose?.() }
  private assertAlive(): void { if (this.disposed) throw new Error('TextureDecoderRegistry is disposed.') }
}

export function generateRgba8MipChain(width: number, height: number, pixels: Uint8Array | Uint8ClampedArray, options: { srgb?: boolean; alphaCoverageCutoff?: number } = {}): readonly TextureMipLevel[] {
  validateLevel(width, height, pixels)
  const levels: TextureMipLevel[] = []
  let sourceWidth = width, sourceHeight = height, source = new Uint8Array(pixels)
  const initialCoverage = options.alphaCoverageCutoff === undefined ? undefined : alphaCoverage(source, options.alphaCoverageCutoff)
  while (sourceWidth > 1 || sourceHeight > 1) {
    const targetWidth = Math.max(1, sourceWidth >> 1), targetHeight = Math.max(1, sourceHeight >> 1)
    const target = new Uint8Array(targetWidth * targetHeight * 4)
    for (let y = 0; y < targetHeight; y += 1) for (let x = 0; x < targetWidth; x += 1) {
      const output = (y * targetWidth + x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0, samples = 0
        for (let oy = 0; oy < 2; oy += 1) for (let ox = 0; ox < 2; ox += 1) {
          const sx = Math.min(sourceWidth - 1, x * 2 + ox), sy = Math.min(sourceHeight - 1, y * 2 + oy)
          let value = (source[(sy * sourceWidth + sx) * 4 + channel] ?? 0) / 255
          if (options.srgb && channel < 3) value = srgbToLinear(value)
          sum += value; samples += 1
        }
        let value = sum / samples
        if (options.srgb && channel < 3) value = linearToSrgb(value)
        target[output + channel] = Math.round(clamp(value, 0, 1) * 255)
      }
    }
    if (initialCoverage !== undefined && options.alphaCoverageCutoff !== undefined) preserveAlphaCoverage(target, options.alphaCoverageCutoff, initialCoverage)
    levels.push(Object.freeze({ width: targetWidth, height: targetHeight, data: target }))
    source = target; sourceWidth = targetWidth; sourceHeight = targetHeight
  }
  return Object.freeze(levels)
}

export function toTextureDataSource(payload: DecodedTexturePayload, colorSpace: 'srgb' | 'linear' = 'linear'): TextureDataSource {
  validateLevel(payload.width, payload.height, payload.data)
  return { kind: 'data', width: payload.width, height: payload.height, data: new Uint8Array(payload.data), format: payload.format ?? (colorSpace === 'srgb' ? 'rgba8unorm-srgb' : 'rgba8unorm'), ...(payload.mipLevels ? { mipLevels: payload.mipLevels.map(level => ({ width: level.width, height: level.height, data: new Uint8Array(level.data) })) } : {}) }
}

function preserveAlphaCoverage(pixels: Uint8Array, cutoff: number, targetCoverage: number): void { let low = 0.25, high = 4; for (let iteration = 0; iteration < 10; iteration += 1) { const scale = (low + high) * 0.5; const coverage = alphaCoverage(pixels, cutoff, scale); if (coverage < targetCoverage) low = scale; else high = scale } const scale = (low + high) * 0.5; for (let index = 3; index < pixels.length; index += 4) pixels[index] = Math.min(255, Math.round((pixels[index] ?? 0) * scale)) }
function alphaCoverage(pixels: Uint8Array, cutoff: number, scale = 1): number { let covered = 0; const threshold = clamp(cutoff, 0, 1) * 255; for (let index = 3; index < pixels.length; index += 4) if ((pixels[index] ?? 0) * scale >= threshold) covered += 1; return covered / Math.max(1, pixels.length / 4) }
function validateLevel(width: number, height: number, data: Uint8Array | Uint8ClampedArray): void { if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error('Texture dimensions must be positive integers.'); if (data.byteLength !== width * height * 4) throw new Error('Texture data must contain RGBA8 texels.') }
function normalizeFormat(value: string): string { return value.trim().toLowerCase().replace(/^\./u, '') }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
function srgbToLinear(value: number): number { return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4) }
function linearToSrgb(value: number): number { return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055 }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
