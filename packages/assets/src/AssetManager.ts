import { EventDispatcher, type Disposable } from '@sekai64-internal/core'

export interface AssetProgress { loaded: number; total?: number; ratio?: number }
export interface AssetLoadOptions {
  signal?: AbortSignal
  onProgress?: (progress: AssetProgress) => void
  retries?: number
  cache?: boolean
  headers?: Readonly<Record<string, string>>
}
export interface AssetResolver {
  canResolve(url: URL): boolean
  fetch(url: URL, options: AssetLoadOptions): Promise<Response>
}
interface AssetEvents { loaded: { key: string; bytes: number }; released: { key: string }; error: { key: string; error: unknown } }
interface CacheEntry<T> { promise: Promise<T>; value?: T; references: number; bytes: number; disposer?: (value: T) => void }

export class AssetLease<T> implements Disposable {
  disposed = false
  constructor(readonly key: string, readonly value: T, private readonly releaseValue: () => void) {}
  dispose(): void { if (this.disposed) return; this.disposed = true; this.releaseValue() }
}

export interface AssetManagerOptions {
  baseUrl?: string | URL
  concurrency?: number
  allowedProtocols?: readonly string[]
}

export class AssetManager extends EventDispatcher<AssetEvents> implements Disposable {
  disposed = false
  readonly baseUrl?: URL
  readonly allowedProtocols: ReadonlySet<string>
  private readonly cache = new Map<string, CacheEntry<unknown>>()
  private readonly resolvers: AssetResolver[] = []
  private readonly queue: Array<{ run: () => void; reject: (error: unknown) => void }> = []
  private active = 0
  private readonly concurrency: number

  constructor(options: AssetManagerOptions = {}) {
    super()
    this.baseUrl = options.baseUrl ? new URL(options.baseUrl, defaultBaseUrl()) : undefined
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 6))
    this.allowedProtocols = new Set(options.allowedProtocols ?? ['http:', 'https:', 'data:', 'blob:', 'file:'])
  }

  addResolver(resolver: AssetResolver): () => void { this.resolvers.unshift(resolver); return () => { const index = this.resolvers.indexOf(resolver); if (index >= 0) this.resolvers.splice(index, 1) } }

  async loadArrayBuffer(source: string | URL, options: AssetLoadOptions = {}): Promise<AssetLease<ArrayBuffer>> {
    return this.load(source, 'arrayBuffer', options, async response => readResponse(response, options), value => value.byteLength)
  }
  async loadText(source: string | URL, options: AssetLoadOptions = {}): Promise<AssetLease<string>> {
    return this.load(source, 'text', options, async response => new TextDecoder().decode(await readResponse(response, options)), value => new TextEncoder().encode(value).byteLength)
  }
  async loadJson<T = unknown>(source: string | URL, options: AssetLoadOptions = {}): Promise<AssetLease<T>> {
    const lease = await this.loadText(source, options)
    try {
      const parsed = JSON.parse(lease.value) as T
      return new AssetLease(lease.key, parsed, () => lease.dispose())
    } catch (error) {
      lease.dispose()
      throw new Error(`Sekai64 failed to parse JSON asset ${lease.key}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  async loadBlob(source: string | URL, options: AssetLoadOptions = {}): Promise<AssetLease<Blob>> {
    return this.load(source, 'blob', options, async response => new Blob([await readResponse(response, options)], { type: response.headers.get('content-type') ?? 'application/octet-stream' }), value => value.size)
  }
  async loadImageBitmap(source: string | URL, options: AssetLoadOptions = {}): Promise<AssetLease<ImageBitmap>> {
    if (typeof createImageBitmap !== 'function') throw new Error('ImageBitmap is unavailable in this environment.')
    return this.load(source, 'imageBitmap', options, async response => createImageBitmap(new Blob([await readResponse(response, options)], { type: response.headers.get('content-type') ?? 'application/octet-stream' })), value => value.width * value.height * 4, value => value.close())
  }

  clearUnused(): void {
    for (const [key, entry] of this.cache) if (entry.references <= 0 && entry.value !== undefined) { entry.disposer?.(entry.value); this.cache.delete(key); this.emit('released', { key }) }
  }
  clear(): void { for (const entry of this.cache.values()) if (entry.value !== undefined) entry.disposer?.(entry.value); this.cache.clear() }
  get stats(): { entries: number; references: number; bytes: number; active: number; queued: number } {
    let references = 0, bytes = 0
    for (const entry of this.cache.values()) { references += entry.references; bytes += entry.bytes }
    return { entries: this.cache.size, references, bytes, active: this.active, queued: this.queue.length }
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clear()
    const error = new Error('AssetManager was disposed before a queued asset load could start.')
    for (const item of this.queue.splice(0)) item.reject(error)
    this.resolvers.length = 0
    this.clearListeners()
  }

  private async load<T>(source: string | URL, kind: string, options: AssetLoadOptions, decode: (response: Response) => Promise<T>, sizeOf: (value: T) => number, disposer?: (value: T) => void): Promise<AssetLease<T>> {
    if (this.disposed) throw new Error('AssetManager is disposed.')
    throwIfAborted(options.signal)
    const url = this.resolve(source)
    const key = `${kind}:${url.href}`
    const useCache = options.cache !== false
    let entry = (useCache ? this.cache.get(key) : undefined) as CacheEntry<T> | undefined
    if (!entry) {
      entry = { references: 0, bytes: 0, disposer, promise: this.schedule(async () => {
        const response = await this.fetchWithRetry(url, options)
        const value = await decode(response)
        entry!.value = value
        entry!.bytes = sizeOf(value)
        this.emit('loaded', { key, bytes: entry!.bytes })
        return value
      }) }
      entry.promise.catch(error => { if (useCache) this.cache.delete(key); this.emit('error', { key, error }) })
      if (useCache) this.cache.set(key, entry as CacheEntry<unknown>)
    }
    const value = await withAbort(entry.promise, options.signal)
    entry.references += 1
    let released = false
    return new AssetLease(key, value, () => {
      if (released) return
      released = true
      entry!.references = Math.max(0, entry!.references - 1)
      if (!useCache && entry!.references === 0) entry!.disposer?.(value)
    })
  }

  private resolve(source: string | URL): URL {
    const url = source instanceof URL ? new URL(source.href) : new URL(source, this.baseUrl ?? defaultBaseUrl())
    if (!this.allowedProtocols.has(url.protocol)) throw new Error(`Asset protocol is not allowed: ${url.protocol}`)
    return url
  }
  private async fetchWithRetry(url: URL, options: AssetLoadOptions): Promise<Response> {
    const retries = Math.max(0, Math.floor(options.retries ?? 1))
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      throwIfAborted(options.signal)
      try {
        const resolver = this.resolvers.find(candidate => candidate.canResolve(url))
        const response = resolver ? await resolver.fetch(url, options) : await fetch(url, { signal: options.signal, headers: options.headers })
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
        return response
      } catch (error) {
        lastError = error
        if (attempt >= retries || options.signal?.aborted) break
        await delay(Math.min(1000, 100 * 2 ** attempt), options.signal)
      }
    }
    throw new Error(`Sekai64 asset load failed for ${url.href}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }
  private schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        if (this.disposed) { reject(new Error('AssetManager is disposed.')); return }
        this.active += 1
        void task().then(resolve, reject).finally(() => {
          this.active -= 1
          this.queue.shift()?.run()
        })
      }
      if (this.active < this.concurrency) run()
      else this.queue.push({ run, reject })
    })
  }
}

async function readResponse(response: Response, options: AssetLoadOptions): Promise<ArrayBuffer> {
  const totalHeader = response.headers.get('content-length')
  const total = totalHeader ? Number(totalHeader) : undefined
  if (!response.body || !options.onProgress) return response.arrayBuffer()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  while (true) {
    throwIfAborted(options.signal)
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); loaded += value.byteLength
    options.onProgress({ loaded, total, ratio: total && total > 0 ? loaded / total : undefined })
  }
  const output = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength }
  return output.buffer
}
function defaultBaseUrl(): string { return typeof location !== 'undefined' ? location.href : 'file:///' }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  throwIfAborted(signal)
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => { cleanup(); reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')) }
    const cleanup = (): void => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}
function delay(milliseconds: number, signal?: AbortSignal): Promise<void> { return new Promise((resolve, reject) => { const handle = setTimeout(resolve, milliseconds); signal?.addEventListener('abort', () => { clearTimeout(handle); reject(signal.reason) }, { once: true }) }) }
