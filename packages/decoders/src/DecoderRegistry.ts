export interface DecoderProgress { loaded: number; total?: number; ratio?: number; stage?: string }
export interface DecodeRequest {
  format: string
  data: ArrayBuffer
  signal?: AbortSignal
  onProgress?: (progress: DecoderProgress) => void
  options?: Readonly<Record<string, unknown>>
}
export interface DecodedAsset<T = unknown> {
  kind: string
  value: T
  transferables?: readonly Transferable[]
  metadata?: Readonly<Record<string, unknown>>
}
export interface Sekai64AssetDecoderAdapter<T = unknown> {
  readonly id: string
  readonly formats: readonly string[]
  decode(request: DecodeRequest): Promise<DecodedAsset<T>>
  dispose?(): void | Promise<void>
}

export class DecoderRegistry {
  private readonly adapters = new Map<string, Sekai64AssetDecoderAdapter>()
  private readonly formats = new Map<string, string>()
  private disposed = false

  register(adapter: Sekai64AssetDecoderAdapter): () => void {
    this.assertAlive()
    if (!adapter.id.trim()) throw new Error('Decoder adapter id cannot be empty.')
    if (this.adapters.has(adapter.id)) throw new Error(`Decoder adapter is already registered: ${adapter.id}`)
    const normalized = [...new Set(adapter.formats.map(normalizeFormat).filter(Boolean))]
    if (normalized.length === 0) throw new Error(`Decoder adapter ${adapter.id} requires at least one format.`)
    for (const format of normalized) if (this.formats.has(format)) throw new Error(`A decoder is already registered for ${format}: ${this.formats.get(format)}`)
    this.adapters.set(adapter.id, adapter)
    for (const format of normalized) this.formats.set(format, adapter.id)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.adapters.delete(adapter.id)
      for (const format of normalized) if (this.formats.get(format) === adapter.id) this.formats.delete(format)
    }
  }

  supports(format: string): boolean { return this.formats.has(normalizeFormat(format)) }
  list(): Readonly<Record<string, string>> { return Object.freeze(Object.fromEntries([...this.formats].sort())) }

  async decode<T = unknown>(request: DecodeRequest): Promise<DecodedAsset<T>> {
    this.assertAlive()
    throwIfAborted(request.signal)
    const format = normalizeFormat(request.format)
    const id = this.formats.get(format)
    const adapter = id ? this.adapters.get(id) : undefined
    if (!adapter) throw new Error(`No Sekai64 decoder adapter is registered for ${format}. Install an explicit optional adapter.`)
    return adapter.decode({ ...request, format }) as Promise<DecodedAsset<T>>
  }

  async disposeAsync(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    const adapters = [...this.adapters.values()].reverse()
    this.adapters.clear(); this.formats.clear()
    for (const adapter of adapters) await adapter.dispose?.()
  }

  private assertAlive(): void { if (this.disposed) throw new Error('DecoderRegistry is disposed.') }
}

function normalizeFormat(value: string): string { return value.trim().toLowerCase().replace(/^\./, '') }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
