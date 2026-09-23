import {
  Texture,
  type TextureColorSpace,
  type TextureImageSource,
  type TextureMagFilter,
  type TextureMinFilter,
  type TextureWrap,
} from '@sekai64-internal/materials'
import type {
  Renderer,
  RendererBackend,
  RendererDiagnostic,
  RendererDiagnosticSink,
} from '@sekai64-internal/renderer'

export type DynamicTextureSource = TextureImageSource
export type DynamicTextureMipmapPolicy = 'none' | 'generate'

export interface DynamicTextureOptions {
  /** Initial canvas, bitmap, image, or pixel frame. */
  source?: DynamicTextureSource
  /** Required when source is omitted. Creates a blank frame. */
  width?: number
  /** Required when source is omitted. Creates a blank frame. */
  height?: number
  label?: string
  flipY?: boolean
  colorSpace?: TextureColorSpace
  minFilter?: TextureMinFilter
  magFilter?: TextureMagFilter
  wrapS?: TextureWrap
  wrapT?: TextureWrap
  mipmaps?: DynamicTextureMipmapPolicy
  /** Additional dimension ceiling. The renderer limit is also enforced when known. */
  maxDimension?: number
  diagnostics?: RendererDiagnosticSink
}

export interface DynamicTextureCapabilityOptions {
  diagnostics?: RendererDiagnosticSink
  /** Default per-texture dimension ceiling. Defaults to 8192. */
  maxDimension?: number
}

/**
 * Renderer-neutral dynamic image resource.
 *
 * `texture` is an ordinary Sekai64 `Texture` and can be assigned to existing
 * materials. Repeated `update()` calls before a render coalesce naturally: the
 * active renderer uploads only the latest texture version it observes.
 */
export interface DynamicTexture {
  readonly texture: Texture
  readonly backend: RendererBackend
  readonly width: number
  readonly height: number
  readonly version: number
  readonly disposed: boolean
  update(source: DynamicTextureSource): void
  resize(width: number, height: number): void
  dispose(): void
}

export interface DynamicTextureCapability {
  readonly backend: RendererBackend
  readonly maxTextureSize: number
  create(options: DynamicTextureOptions): DynamicTexture
}

/**
 * Creates an optional dynamic-texture capability without changing the required
 * Renderer interface or importing either concrete renderer backend.
 */
export function createDynamicTextureCapability(
  renderer: Pick<Renderer, 'backend' | 'capabilities' | 'disposed'>,
  options: DynamicTextureCapabilityOptions = {},
): DynamicTextureCapability {
  return new RendererDynamicTextureCapability(renderer, options)
}

class RendererDynamicTextureCapability implements DynamicTextureCapability {
  readonly backend: RendererBackend
  private readonly renderer: Pick<Renderer, 'backend' | 'capabilities' | 'disposed'>
  private readonly diagnostics?: RendererDiagnosticSink
  private readonly configuredMaxDimension: number

  constructor(
    renderer: Pick<Renderer, 'backend' | 'capabilities' | 'disposed'>,
    options: DynamicTextureCapabilityOptions,
  ) {
    this.renderer = renderer
    this.backend = renderer.backend
    this.diagnostics = options.diagnostics
    this.configuredMaxDimension = positiveInteger(options.maxDimension ?? 8192, 'maxDimension')
  }

  get maxTextureSize(): number {
    const rendererLimit = this.renderer.capabilities.maxTextureSize
    return rendererLimit > 0
      ? Math.min(rendererLimit, this.configuredMaxDimension)
      : this.configuredMaxDimension
  }

  create(options: DynamicTextureOptions): DynamicTexture {
    if (this.renderer.disposed) throw new Error('Cannot create a dynamic texture from a disposed renderer capability.')
    const diagnostics = mergeDiagnostics(this.diagnostics, options.diagnostics)
    const maxDimension = Math.min(
      this.maxTextureSize,
      positiveInteger(options.maxDimension ?? this.configuredMaxDimension, 'maxDimension'),
    )
    const mipmaps = options.mipmaps ?? 'none'
    const source = options.source ?? createBlankSource(
      positiveInteger(options.width, 'width'),
      positiveInteger(options.height, 'height'),
    )
    validateSourceDimensions(source, maxDimension, diagnostics, options.label)
    const texture = new Texture({
      source,
      ...(options.label !== undefined ? { label: options.label } : {}),
      ...(options.flipY !== undefined ? { flipY: options.flipY } : {}),
      ...(options.colorSpace !== undefined ? { colorSpace: options.colorSpace } : {}),
      ...(options.minFilter !== undefined ? { minFilter: options.minFilter } : {}),
      ...(options.magFilter !== undefined ? { magFilter: options.magFilter } : {}),
      ...(options.wrapS !== undefined ? { wrapS: options.wrapS } : {}),
      ...(options.wrapT !== undefined ? { wrapT: options.wrapT } : {}),
      generateMipmaps: mipmaps === 'generate',
    })
    return new ManagedDynamicTexture(this.backend, texture, maxDimension, diagnostics)
  }
}

class ManagedDynamicTexture implements DynamicTexture {
  readonly texture: Texture
  readonly backend: RendererBackend
  private readonly maxDimension: number
  private readonly diagnostics?: RendererDiagnosticSink

  constructor(
    backend: RendererBackend,
    texture: Texture,
    maxDimension: number,
    diagnostics?: RendererDiagnosticSink,
  ) {
    this.backend = backend
    this.texture = texture
    this.maxDimension = maxDimension
    this.diagnostics = diagnostics
  }

  get width(): number { return this.texture.width }
  get height(): number { return this.texture.height }
  get version(): number { return this.texture.version }
  get disposed(): boolean { return this.texture.disposed }

  update(source: DynamicTextureSource): void {
    this.assertAlive()
    validateSourceDimensions(source, this.maxDimension, this.diagnostics, this.texture.label)
    this.texture.setImage(source)
  }

  resize(width: number, height: number): void {
    this.assertAlive()
    const nextWidth = positiveInteger(width, 'width')
    const nextHeight = positiveInteger(height, 'height')
    validateDimensions(nextWidth, nextHeight, this.maxDimension, this.diagnostics, this.texture.label)
    this.texture.setImage(createBlankSource(nextWidth, nextHeight))
  }

  dispose(): void {
    this.texture.dispose()
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('DynamicTexture is disposed.')
  }
}

function createBlankSource(width: number, height: number): DynamicTextureSource {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  if (typeof ImageData !== 'undefined') return new ImageData(width, height)
  throw new Error('Creating or resizing a blank dynamic texture requires OffscreenCanvas, document canvas, or ImageData support.')
}

function sourceDimensions(source: DynamicTextureSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height }
  }
  return { width: source.width, height: source.height }
}

function validateSourceDimensions(
  source: DynamicTextureSource,
  maxDimension: number,
  diagnostics: RendererDiagnosticSink | undefined,
  label: string | undefined,
): void {
  const { width, height } = sourceDimensions(source)
  validateDimensions(width, height, maxDimension, diagnostics, label)
}

function validateDimensions(
  width: number,
  height: number,
  maxDimension: number,
  diagnostics: RendererDiagnosticSink | undefined,
  label: string | undefined,
): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    const diagnostic: RendererDiagnostic = {
      severity: 'error',
      code: 'SEKAI64_DYNAMIC_TEXTURE_INVALID_SIZE',
      message: 'Dynamic texture dimensions must be positive integers.',
      details: { width, height, texture: label },
    }
    diagnostics?.(diagnostic)
    throw new Error(diagnostic.message)
  }
  if (width > maxDimension || height > maxDimension) {
    const diagnostic: RendererDiagnostic = {
      severity: 'error',
      code: 'SEKAI64_DYNAMIC_TEXTURE_SIZE_LIMIT',
      message: `Dynamic texture dimensions ${width}×${height} exceed the ${maxDimension}-pixel limit.`,
      details: { width, height, maximum: maxDimension, texture: label },
    }
    diagnostics?.(diagnostic)
    throw new Error(diagnostic.message)
  }
}

function positiveInteger(value: number | undefined, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`Dynamic texture ${name} must be a positive integer.`)
  return value as number
}

function mergeDiagnostics(
  first: RendererDiagnosticSink | undefined,
  second: RendererDiagnosticSink | undefined,
): RendererDiagnosticSink | undefined {
  if (!first) return second
  if (!second || second === first) return first
  return diagnostic => {
    first(diagnostic)
    second(diagnostic)
  }
}
