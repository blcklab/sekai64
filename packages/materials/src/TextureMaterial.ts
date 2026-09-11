import { Color, type ColorInput } from '@sekai64-internal/math'
import { Material, type MaterialOptions } from './Material.js'
import { Texture } from './Texture.js'

export interface TextureMaterialOptions extends MaterialOptions {
  map: Texture
  tint?: ColorInput
  alphaCutoff?: number
  ownsTexture?: boolean
}

/** Lightweight unlit material for text, signs, images, and UI surfaces. */
export class TextureMaterial extends Material {
  readonly tint: Color
  map: Texture
  alphaCutoff: number
  ownsTexture: boolean

  constructor(options: TextureMaterialOptions) {
    super({ ...options, transparent: options.transparent ?? true, doubleSided: options.doubleSided ?? true })
    this.map = options.map
    this.tint = Color.from(options.tint ?? '#ffffff')
    this.alphaCutoff = clamp01(options.alphaCutoff ?? 0)
    this.ownsTexture = options.ownsTexture ?? false
  }

  setMap(map: Texture, ownsTexture = false): this {
    this.assertAlive()
    if (this.ownsTexture && this.map !== map) this.map.dispose()
    this.map = map
    this.ownsTexture = ownsTexture
    this.markChanged()
    return this
  }

  setTint(value: ColorInput): this { this.tint.set(value); this.markChanged(); return this }
  setAlphaCutoff(value: number): this { this.alphaCutoff = clamp01(value); this.markChanged(); return this }

  protected override release(): void {
    if (this.ownsTexture) this.map.dispose()
    super.release()
  }
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }
