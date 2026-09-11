import type { Disposable } from '@sekai64-internal/core'

export type AssetTaskPriority = 'critical' | 'high' | 'normal' | 'low' | number
export interface AssetTaskContext { signal: AbortSignal; report(progress: number, stage?: string): void }
export interface AssetTaskOptions<T = unknown> {
  priority?: AssetTaskPriority
  signal?: AbortSignal
  cache?: boolean
  onProgress?: (progress: number, stage?: string) => void
  /** Called when an unreferenced cached value is evicted or the scheduler is disposed. */
  disposeValue?: (value: T) => void
  estimatedBytes?: number
}

export interface AssetTaskSchedulerOptions {
  concurrency?: number
  maximumQueued?: number
}

export interface AssetTaskSchedulerStats {
  active: number
  queued: number
  cached: number
  references: number
  residentBytes: number
  completed: number
  failed: number
  cancelled: number
  cacheHits: number
  progressEvents: number
}

interface TaskEntry<T> {
  key: string
  priority: number
  sequence: number
  controller: AbortController
  execute: (context: AssetTaskContext) => Promise<T>
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
  value?: T
  references: number
  cache: boolean
  started: boolean
  onProgress: Set<(progress: number, stage?: string) => void>
  disposeValue?: (value: T) => void
  estimatedBytes: number
  lastUsedSequence: number
}

export class AssetTaskLease<T> implements Disposable {
  disposed = false
  constructor(readonly key: string, readonly value: T, private readonly releaseValue: () => void) {}
  dispose(): void { if (this.disposed) return; this.disposed = true; this.releaseValue() }
}

export class AssetTaskScheduler implements Disposable {
  disposed = false
  readonly concurrency: number
  readonly maximumQueued: number
  private readonly entries = new Map<string, TaskEntry<unknown>>()
  private readonly queue: TaskEntry<unknown>[] = []
  private active = 0
  private sequence = 0
  private completed = 0
  private failed = 0
  private cancelled = 0
  private cacheHits = 0
  private progressEvents = 0

  constructor(options: number | AssetTaskSchedulerOptions = 4) {
    const resolved = typeof options === 'number' ? { concurrency: options } : options
    this.concurrency = Math.max(1, Math.floor(resolved.concurrency ?? 4))
    this.maximumQueued = Math.max(this.concurrency, Math.floor(resolved.maximumQueued ?? 4096))
  }

  async schedule<T>(key: string, execute: (context: AssetTaskContext) => Promise<T>, options: AssetTaskOptions<T> = {}): Promise<AssetTaskLease<T>> {
    if (this.disposed) throw new Error('AssetTaskScheduler is disposed.')
    throwIfAborted(options.signal)
    const cache = options.cache !== false
    let entry = (cache ? this.entries.get(key) : undefined) as TaskEntry<T> | undefined
    if (entry) this.cacheHits += 1
    if (!entry) {
      if (this.queue.length >= this.maximumQueued) throw new Error(`Asset task queue limit (${this.maximumQueued}) exceeded.`)
      let resolve!: (value: T) => void
      let reject!: (reason: unknown) => void
      const promise = new Promise<T>((resolveValue, rejectValue) => { resolve = resolveValue; reject = rejectValue })
      entry = {
        key,
        priority: normalizePriority(options.priority),
        sequence: this.sequence++,
        controller: new AbortController(),
        execute,
        promise,
        resolve,
        reject,
        references: 0,
        cache,
        started: false,
        onProgress: new Set(options.onProgress ? [options.onProgress] : []),
        ...(options.disposeValue ? { disposeValue: options.disposeValue } : {}),
        estimatedBytes: Math.max(0, options.estimatedBytes ?? 0),
        lastUsedSequence: this.sequence,
      }
      if (cache) this.entries.set(key, entry as TaskEntry<unknown>)
      this.queue.push(entry as TaskEntry<unknown>)
      this.sortQueue()
      this.pump()
    }
    if (options.onProgress) entry.onProgress.add(options.onProgress)
    const stopAbort = forwardAbort(options.signal, entry.controller)
    try {
      const value = await withAbort(entry.promise, options.signal)
      entry.references += 1
      entry.value = value
      entry.lastUsedSequence = this.sequence++
      let released = false
      return new AssetTaskLease(key, value, () => {
        if (released) return
        released = true
        entry!.references = Math.max(0, entry!.references - 1)
        entry!.lastUsedSequence = this.sequence++
        if (options.onProgress) entry!.onProgress.delete(options.onProgress)
        if (!entry!.cache && entry!.references === 0) this.evictEntry(entry as TaskEntry<unknown>)
      })
    } finally { stopAbort() }
  }

  setPriority(key: string, priority: AssetTaskPriority): void {
    const entry = this.entries.get(key)
    if (!entry || entry.started) return
    entry.priority = normalizePriority(priority)
    this.sortQueue()
  }

  cancel(key: string, reason: unknown = new DOMException('The asset task was cancelled.', 'AbortError')): void {
    const entry = this.entries.get(key)
    if (!entry || entry.controller.signal.aborted) return
    this.cancelled += 1
    entry.controller.abort(reason)
    if (!entry.started) {
      const index = this.queue.indexOf(entry)
      if (index >= 0) this.queue.splice(index, 1)
      this.entries.delete(key)
      entry.reject(reason)
    }
  }

  clearUnused(maximumResidentBytes = 0): number {
    const candidates = [...this.entries.values()].filter(entry => entry.references === 0 && entry.value !== undefined).sort((a, b) => a.lastUsedSequence - b.lastUsedSequence)
    let residentBytes = this.residentBytes
    let evicted = 0
    for (const entry of candidates) {
      if (maximumResidentBytes > 0 && residentBytes <= maximumResidentBytes) break
      residentBytes -= entry.estimatedBytes
      this.evictEntry(entry)
      evicted += 1
    }
    return evicted
  }

  get stats(): AssetTaskSchedulerStats {
    let references = 0
    for (const entry of this.entries.values()) references += entry.references
    return {
      active: this.active,
      queued: this.queue.length,
      cached: this.entries.size,
      references,
      residentBytes: this.residentBytes,
      completed: this.completed,
      failed: this.failed,
      cancelled: this.cancelled,
      cacheHits: this.cacheHits,
      progressEvents: this.progressEvents,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of this.entries.values()) {
      entry.controller.abort(new Error('AssetTaskScheduler disposed.'))
      this.disposeEntryValue(entry)
    }
    for (const entry of this.queue.splice(0)) entry.reject(new Error('AssetTaskScheduler disposed before task start.'))
    this.entries.clear()
  }

  private get residentBytes(): number {
    let bytes = 0
    for (const entry of this.entries.values()) if (entry.value !== undefined) bytes += entry.estimatedBytes
    return bytes
  }

  private pump(): void {
    while (!this.disposed && this.active < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()
      if (!entry) break
      entry.started = true
      this.active += 1
      const report = (progress: number, stage?: string): void => {
        this.progressEvents += 1
        for (const listener of entry.onProgress) listener(Math.max(0, Math.min(1, progress)), stage)
      }
      void entry.execute({ signal: entry.controller.signal, report }).then(value => {
        entry.value = value
        this.completed += 1
        entry.resolve(value)
      }, error => {
        this.failed += 1
        this.entries.delete(entry.key)
        entry.reject(error)
      }).finally(() => { this.active -= 1; this.pump() })
    }
  }

  private evictEntry(entry: TaskEntry<unknown>): void {
    this.entries.delete(entry.key)
    this.disposeEntryValue(entry)
  }

  private disposeEntryValue(entry: TaskEntry<unknown>): void {
    if (entry.value === undefined || !entry.disposeValue) return
    entry.disposeValue(entry.value)
    entry.value = undefined
  }

  private sortQueue(): void { this.queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence) }
}

function normalizePriority(value: AssetTaskPriority | undefined): number { if (typeof value === 'number') return Number.isFinite(value) ? value : 0; return value === 'critical' ? 100 : value === 'high' ? 50 : value === 'low' ? -50 : 0 }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
function forwardAbort(source: AbortSignal | undefined, target: AbortController): () => void { if (!source) return () => undefined; if (source.aborted) { target.abort(source.reason); return () => undefined }; const listener = (): void => target.abort(source.reason); source.addEventListener('abort', listener, { once: true }); return () => source.removeEventListener('abort', listener) }
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> { if (!signal) return promise; throwIfAborted(signal); return new Promise((resolve, reject) => { const abort = (): void => { cleanup(); reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')) }; const cleanup = (): void => signal.removeEventListener('abort', abort); signal.addEventListener('abort', abort, { once: true }); void promise.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) }) }) }
