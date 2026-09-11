import { PlaneGeometry } from '@sekai64-internal/geometry'
import { createTextTexture, Texture, TextureMaterial, type TextTextureOptions, type TextureLoadOptions, type TextureSource } from '@sekai64-internal/materials'
import type { ColorInput } from '@sekai64-internal/math'
import { Mesh } from './Mesh.js'
import type { NodeOptions } from './Node.js'

export interface TextMeshOptions extends NodeOptions, TextTextureOptions {
  worldWidth?: number
  worldHeight?: number
  tint?: ColorInput
}

/** A four-vertex, unlit text surface backed by a generated canvas texture. */
export class TextMesh extends Mesh {
  text: string
  readonly textOptions: TextMeshOptions

  constructor(text: string, options: TextMeshOptions = {}) {
    const texture = createTextTexture(text, options)
    const size = worldSize(texture, options.worldWidth ?? 2, options.worldHeight)
    super({
      ...options,
      tags: [...(options.tags ?? []), 'text', 'media'],
      geometry: new PlaneGeometry({ width: size.width, height: size.height, label: `${options.id ?? 'text'}:geometry` }),
      material: new TextureMaterial({ map: texture, tint: options.tint, ownsTexture: true, transparent: true, doubleSided: true, label: `${options.id ?? 'text'}:material` }),
      ownsResources: true
    })
    this.text = text
    this.textOptions = { ...options }
  }

  get texture(): Texture { return (this.material as TextureMaterial).map }

  setText(text: string, options: Partial<TextMeshOptions> = {}): this {
    this.assertAlive()
    const nextOptions = { ...this.textOptions, ...options }
    const texture = createTextTexture(text, nextOptions)
    const size = worldSize(texture, nextOptions.worldWidth ?? 2, nextOptions.worldHeight)
    this.setGeometry(new PlaneGeometry({ width: size.width, height: size.height, label: `${this.id || 'text'}:geometry` }), { disposePrevious: true, ownsResource: true })
    ;(this.material as TextureMaterial).setMap(texture, true)
    Object.assign(this.textOptions, nextOptions)
    this.text = text
    return this
  }
}

export interface ImageMeshOptions extends NodeOptions {
  autoload?: boolean
  loadOptions?: TextureLoadOptions
  worldWidth?: number
  worldHeight?: number
  tint?: ColorInput
  transparent?: boolean
  alphaCutoff?: number
  flipY?: boolean
  label?: string
}

/** Lightweight image surface with dependency-free asynchronous decoding. */
export class ImageMesh extends Mesh {
  readonly texture: Texture
  readonly imageOptions: ImageMeshOptions
  readonly ready: Promise<this>

  constructor(source: Texture | TextureSource, options: ImageMeshOptions = {}) {
    const texture = source instanceof Texture ? source : new Texture({ source, flipY: options.flipY, label: options.label ?? `${options.id ?? 'image'}:texture` })
    const size = worldSize(texture, options.worldWidth ?? 2, options.worldHeight)
    super({
      ...options,
      tags: [...(options.tags ?? []), 'image', 'media'],
      geometry: new PlaneGeometry({ width: size.width, height: size.height, label: `${options.id ?? 'image'}:geometry` }),
      material: new TextureMaterial({ map: texture, tint: options.tint, alphaCutoff: options.alphaCutoff, transparent: options.transparent ?? true, doubleSided: true, ownsTexture: !(source instanceof Texture), label: `${options.id ?? 'image'}:material` }),
      ownsResources: true
    })
    this.texture = texture
    this.imageOptions = { ...options }
    this.ready = texture.ready || options.autoload === false ? Promise.resolve(this) : this.load(options.loadOptions)
    void this.ready.catch(() => undefined)
  }

  static async create(source: Texture | TextureSource, options: ImageMeshOptions & TextureLoadOptions = {}): Promise<ImageMesh> {
    const mesh = new ImageMesh(source, { ...options, autoload: false })
    await mesh.load(options)
    return mesh
  }

  async setSource(source: TextureSource, options: TextureLoadOptions = this.imageOptions.loadOptions ?? {}): Promise<this> {
    this.assertAlive()
    this.texture.setSource(source)
    return this.load(options)
  }

  async load(options: TextureLoadOptions = {}): Promise<this> {
    await this.texture.load(options)
    if (this.imageOptions.worldHeight === undefined) {
      const size = worldSize(this.texture, this.imageOptions.worldWidth ?? 2, undefined)
      this.setGeometry(new PlaneGeometry({ width: size.width, height: size.height, label: `${this.id || 'image'}:geometry` }), { disposePrevious: true, ownsResource: true })
    }
    return this
  }
}

function worldSize(texture: Texture, width: number, height: number | undefined): { width: number; height: number } {
  const safeWidth = Math.max(0.0001, width)
  if (height !== undefined) return { width: safeWidth, height: Math.max(0.0001, height) }
  return { width: safeWidth, height: safeWidth * texture.height / texture.width }
}
