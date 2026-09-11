export interface AssetLoadRequest {
  type: string
  format: string
  src: string
  id?: string
  signal?: AbortSignal
  options?: Readonly<Record<string, unknown>>
}

export interface AssetLoaderRegistration<T = unknown> {
  type: string
  formats: readonly string[]
  load(request: AssetLoadRequest): Promise<T>
  dispose?(): void
}

interface LoaderEntry {
  registration: AssetLoaderRegistration
  formats: Set<string>
}

/**
 * Small format registry used by render adapters and applications.
 * Sekai64 does not assume that every model or media format belongs in core.
 */
export class AssetLoaderRegistry {
  private readonly entries: LoaderEntry[] = []

  register<T>(registration: AssetLoaderRegistration<T>): () => void {
    const type = registration.type.trim().toLowerCase()
    const formats = new Set(registration.formats.map(normalizeFormat).filter(Boolean))
    if (!type) throw new Error('Asset loaders require a non-empty type.')
    if (formats.size === 0) throw new Error(`Asset loader "${type}" requires at least one format.`)
    for (const format of formats) {
      if (this.resolve(type, format)) throw new Error(`An asset loader is already registered for ${type}/${format}.`)
    }
    const normalized: AssetLoaderRegistration = { ...registration, type, formats: [...formats] }
    const entry: LoaderEntry = { registration: normalized, formats }
    this.entries.push(entry)
    return () => {
      const index = this.entries.indexOf(entry)
      if (index >= 0) this.entries.splice(index, 1)
    }
  }

  resolve(type: string, format: string): AssetLoaderRegistration | undefined {
    const normalizedType = type.trim().toLowerCase()
    const normalizedFormat = normalizeFormat(format)
    return this.entries.find((entry) => entry.registration.type === normalizedType && entry.formats.has(normalizedFormat))?.registration
  }

  supports(type: string, format: string): boolean {
    return this.resolve(type, format) !== undefined
  }

  formats(type: string): readonly string[] {
    const normalizedType = type.trim().toLowerCase()
    return [...new Set(this.entries
      .filter((entry) => entry.registration.type === normalizedType)
      .flatMap((entry) => [...entry.formats]))].sort()
  }

  capabilities(): Readonly<Record<string, readonly string[]>> {
    const result: Record<string, readonly string[]> = {}
    for (const entry of this.entries) result[entry.registration.type] = this.formats(entry.registration.type)
    return result
  }

  async load<T = unknown>(request: AssetLoadRequest): Promise<T> {
    const loader = this.resolve(request.type, request.format)
    if (!loader) throw new Error(`No asset loader is registered for ${request.type}/${request.format}.`)
    return loader.load({ ...request, type: request.type.toLowerCase(), format: normalizeFormat(request.format) }) as Promise<T>
  }

  dispose(): void {
    const disposed = new Set<AssetLoaderRegistration>()
    for (const entry of this.entries) {
      if (disposed.has(entry.registration)) continue
      disposed.add(entry.registration)
      entry.registration.dispose?.()
    }
    this.entries.length = 0
  }
}

function normalizeFormat(format: string): string {
  return format.trim().toLowerCase().replace(/^\./, '')
}
