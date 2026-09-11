import { ManagedResource } from '@sekai64-internal/core'

export type TextureMagFilter = 'nearest' | 'linear'
export type TextureMinFilter = 'nearest' | 'linear' | 'nearest-mipmap-nearest' | 'linear-mipmap-nearest' | 'nearest-mipmap-linear' | 'linear-mipmap-linear'
export type TextureFilter = TextureMagFilter
export type TextureWrap = 'clamp-to-edge' | 'repeat' | 'mirror-repeat'
export type TextureColorSpace = 'srgb' | 'linear'
export type TextureStatus = 'idle' | 'loading' | 'ready' | 'error'
export type TextureImageSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageData
export type TextureDataFormat = 'rgba8unorm' | 'rgba8unorm-srgb'
export interface TextureMipLevel { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface TextureDataSource {
  kind: 'data'
  width: number
  height: number
  data: Uint8Array | Uint8ClampedArray
  format?: TextureDataFormat
  /** Optional complete mip chain excluding or including level zero. */
  mipLevels?: readonly TextureMipLevel[]
}
export type TextureSource = string | URL | Blob | TextureImageSource | TextureDataSource

export interface TextureOptions {
  source: TextureSource
  label?: string
  flipY?: boolean
  colorSpace?: TextureColorSpace
  minFilter?: TextureMinFilter
  magFilter?: TextureMagFilter
  wrapS?: TextureWrap
  wrapT?: TextureWrap
  generateMipmaps?: boolean
  crossOrigin?: string | null
}

export interface TextureLoadOptions {
  signal?: AbortSignal
  fetch?: typeof globalThis.fetch
  /** Maximum encoded download/blob size. Defaults to 32 MiB. */
  maxBytes?: number
  /** Maximum decoded width or height. Defaults to 8192 pixels. */
  maxDimension?: number
}

/** CPU-side image resource uploaded lazily by the active renderer. */
export class Texture extends ManagedResource {
  source: TextureSource
  image?: TextureImageSource
  dataSource?: TextureDataSource
  width = 1
  height = 1
  version = 0
  status: TextureStatus = 'idle'
  error?: unknown
  readonly flipY: boolean
  readonly colorSpace: TextureColorSpace
  readonly minFilter: TextureMinFilter
  readonly magFilter: TextureMagFilter
  readonly wrapS: TextureWrap
  readonly wrapT: TextureWrap
  readonly generateMipmaps: boolean
  readonly crossOrigin: string | null
  private ownsImage = false
  private loading?: Promise<this>
  private generation = 0

  constructor(options: TextureOptions) {
    super(options.label)
    this.source = options.source
    this.flipY = options.flipY ?? true
    this.colorSpace = options.colorSpace ?? 'srgb'
    this.minFilter = options.minFilter ?? 'linear'
    this.magFilter = options.magFilter ?? 'linear'
    this.wrapS = options.wrapS ?? 'clamp-to-edge'
    this.wrapT = options.wrapT ?? 'clamp-to-edge'
    this.generateMipmaps = options.generateMipmaps ?? false
    this.crossOrigin = options.crossOrigin ?? 'anonymous'
    if (isTextureDataSource(options.source)) this.commitData(options.source)
    else if (isReadyTextureImageSource(options.source)) this.commitImage(options.source, false)
  }

  get ready(): boolean { return this.status === 'ready' && (this.image !== undefined || this.dataSource !== undefined) }
  get estimatedBytes(): number {
    if (!this.ready) return 0
    if (this.dataSource) return this.dataSource.data.byteLength + (this.dataSource.mipLevels?.reduce((sum, level) => sum + level.data.byteLength, 0) ?? 0)
    return this.width * this.height * 4
  }

  load(options: TextureLoadOptions = {}): Promise<this> {
    this.assertAlive()
    if (this.ready) return Promise.resolve(this)
    if (this.loading) return this.loading
    const source = this.source
    const generation = ++this.generation
    this.status = 'loading'
    this.error = undefined
    const promise = this.decodeSource(source, options).then(({ image, owned }) => {
      if (this.disposed) {
        closeImage(image, owned)
        throw new Error(`Texture${this.label ? ` (${this.label})` : ''} was disposed while loading.`)
      }
      if (generation !== this.generation || source !== this.source) {
        closeImage(image, owned)
        throw new Error(`Texture${this.label ? ` (${this.label})` : ''} source changed while loading.`)
      }
      this.commitImage(image, owned)
      return this
    }).catch(error => {
      if (generation === this.generation) {
        this.status = 'error'
        this.error = error
        this.loading = undefined
      }
      throw error
    })
    this.loading = promise
    return promise
  }

  setSource(source: TextureSource): this {
    this.assertAlive()
    this.generation += 1
    this.releaseOwnedImage()
    this.source = source
    this.image = undefined
    this.dataSource = undefined
    this.width = 1
    this.height = 1
    this.status = 'idle'
    this.error = undefined
    this.loading = undefined
    this.version += 1
    if (isTextureDataSource(source)) this.commitData(source)
    else if (isReadyTextureImageSource(source)) this.commitImage(source, false)
    return this
  }

  setData(source: TextureDataSource): this {
    this.assertAlive()
    this.generation += 1
    this.commitData(source)
    return this
  }

  setImage(image: TextureImageSource, owned = false): this {
    this.assertAlive()
    this.generation += 1
    this.commitImage(image, owned)
    return this
  }

  protected release(): void {
    this.generation += 1
    this.releaseOwnedImage()
    this.image = undefined
    this.dataSource = undefined
    this.loading = undefined
    this.status = 'idle'
    this.version += 1
  }

  private commitData(source: TextureDataSource): void {
    this.releaseOwnedImage()
    validateTextureData(source)
    this.image = undefined
    this.dataSource = cloneTextureData(source)
    this.width = source.width
    this.height = source.height
    this.ownsImage = false
    this.status = 'ready'
    this.error = undefined
    this.loading = undefined
    this.version += 1
  }

  private commitImage(image: TextureImageSource, owned: boolean): void {
    this.releaseOwnedImage()
    const size = imageSize(image)
    if (size.width < 1 || size.height < 1) throw new Error('Texture image dimensions must be greater than zero.')
    this.image = image
    this.dataSource = undefined
    this.width = size.width
    this.height = size.height
    this.ownsImage = owned
    this.status = 'ready'
    this.error = undefined
    this.loading = undefined
    this.version += 1
  }

  private async decodeSource(source: TextureSource, options: TextureLoadOptions): Promise<{ image: TextureImageSource; owned: boolean }> {
    throwIfAborted(options.signal)
    const limits = resolveLimits(options)
    if (isTextureDataSource(source)) throw new Error('Raw texture data is already ready and must not enter the asynchronous decoder path.')
    if (isTextureImageSource(source)) {
      if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement && !isReadyTextureImageSource(source)) await waitForHtmlImage(source, options.signal)
      validateImageSize(source, limits.maxDimension)
      return { image: source, owned: false }
    }
    const blob = source instanceof Blob ? source : await fetchBlob(source, options, limits.maxBytes)
    if (blob.size > limits.maxBytes) throw new Error(`Texture source exceeds the ${limits.maxBytes}-byte loading limit.`)
    throwIfAborted(options.signal)
    if (typeof createImageBitmap === 'function') {
      const image = await createImageBitmap(blob)
      try {
        throwIfAborted(options.signal)
        validateImageSize(image, limits.maxDimension)
      } catch (error) {
        image.close()
        throw error
      }
      return { image, owned: true }
    }
    if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
      const image = await loadHtmlImage(blob, this.crossOrigin, options.signal)
      validateImageSize(image, limits.maxDimension)
      return { image, owned: false }
    }
    throw new Error('Texture decoding requires createImageBitmap or an HTML document with Image support.')
  }

  private releaseOwnedImage(): void {
    closeImage(this.image, this.ownsImage)
    this.ownsImage = false
  }
}

export function loadTexture(source: TextureSource, options: Omit<TextureOptions, 'source'> & TextureLoadOptions = {}): Promise<Texture> {
  const texture = new Texture({ ...options, source })
  return texture.load(options)
}

function isTextureImageSource(value: TextureSource): value is TextureImageSource {
  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) return true
  if (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement) return true
  if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) return true
  if (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas) return true
  return typeof ImageData !== 'undefined' && value instanceof ImageData
}

function isReadyTextureImageSource(value: TextureSource): value is TextureImageSource {
  if (!isTextureImageSource(value)) return false
  if (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement) return value.complete && (value.naturalWidth || value.width) > 0 && (value.naturalHeight || value.height) > 0
  return value.width > 0 && value.height > 0
}

function waitForHtmlImage(image: HTMLImageElement, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cleanup = (): void => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted) }
    const loaded = (): void => { cleanup(); resolve() }
    const failed = (): void => { cleanup(); reject(new Error('The image could not be decoded.')) }
    const aborted = (): void => { cleanup(); reject(abortError(signal)) }
    image.addEventListener('load', loaded, { once: true })
    image.addEventListener('error', failed, { once: true })
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

function imageSize(image: TextureImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
  }
  return { width: image.width, height: image.height }
}

function validateImageSize(image: TextureImageSource, maxDimension: number): void {
  const { width, height } = imageSize(image)
  if (width < 1 || height < 1) throw new Error('Texture image dimensions must be greater than zero.')
  if (width > maxDimension || height > maxDimension) throw new Error(`Texture dimensions ${width}×${height} exceed the ${maxDimension}-pixel decoding limit.`)
}

async function fetchBlob(source: string | URL, options: TextureLoadOptions, maxBytes: number): Promise<Blob> {
  validateTextureUrl(source)
  const fetcher = options.fetch ?? globalThis.fetch
  if (typeof fetcher !== 'function') throw new Error('Texture URL loading requires fetch support.')
  const response = await fetcher(source, { signal: options.signal })
  if (!response.ok) throw new Error(`Texture load failed: HTTP ${response.status} ${response.statusText}`)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error(`Texture response exceeds the ${maxBytes}-byte loading limit.`)
  return response.blob()
}

function validateTextureUrl(source: string | URL): void {
  const raw = String(source)
  const protocol = source instanceof URL ? source.protocol : /^[a-z][a-z\d+.-]*:/i.exec(raw)?.[0].toLowerCase()
  if (protocol && !['http:', 'https:', 'blob:', 'data:'].includes(protocol)) throw new Error(`Texture URL protocol ${protocol} is not allowed.`)
}

function loadHtmlImage(blob: Blob, crossOrigin: string | null, signal?: AbortSignal): Promise<HTMLImageElement> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    if (crossOrigin !== null) image.crossOrigin = crossOrigin
    const cleanup = (): void => { URL.revokeObjectURL(objectUrl); signal?.removeEventListener('abort', abort) }
    const abort = (): void => { cleanup(); image.src = ''; reject(abortError(signal)) }
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error('The image could not be decoded.')) }
    signal?.addEventListener('abort', abort, { once: true })
    image.src = objectUrl
  })
}

function resolveLimits(options: TextureLoadOptions): { maxBytes: number; maxDimension: number } {
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024
  const maxDimension = options.maxDimension ?? 8192
  if (!(maxBytes > 0) || !Number.isFinite(maxBytes)) throw new Error('Texture maxBytes must be a finite positive number.')
  if (!(maxDimension > 0) || !Number.isFinite(maxDimension)) throw new Error('Texture maxDimension must be a finite positive number.')
  return { maxBytes, maxDimension }
}

function closeImage(image: TextureImageSource | undefined, owned: boolean): void {
  if (owned && image && typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
}

function abortError(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function isTextureDataSource(value: TextureSource): value is TextureDataSource {
  return typeof value === 'object' && value !== null && 'kind' in value && (value as { kind?: unknown }).kind === 'data'
}

function validateTextureData(source: TextureDataSource): void {
  if (!Number.isInteger(source.width) || source.width < 1 || !Number.isInteger(source.height) || source.height < 1) throw new Error('Texture data dimensions must be positive integers.')
  if (source.data.byteLength !== source.width * source.height * 4) throw new Error('Texture level-zero data must contain RGBA8 texels.')
  let previousWidth = source.width
  let previousHeight = source.height
  for (const level of source.mipLevels ?? []) {
    if (!Number.isInteger(level.width) || level.width < 1 || !Number.isInteger(level.height) || level.height < 1) throw new Error('Texture mip dimensions must be positive integers.')
    if (level.width > previousWidth || level.height > previousHeight) throw new Error('Texture mip levels must not grow in size.')
    if (level.data.byteLength !== level.width * level.height * 4) throw new Error('Texture mip data must contain RGBA8 texels.')
    previousWidth = level.width
    previousHeight = level.height
  }
}

function cloneTextureData(source: TextureDataSource): TextureDataSource {
  return { kind: 'data', width: source.width, height: source.height, data: new Uint8Array(source.data), format: source.format ?? 'rgba8unorm', ...(source.mipLevels ? { mipLevels: source.mipLevels.map(level => ({ width: level.width, height: level.height, data: new Uint8Array(level.data) })) } : {}) }
}

