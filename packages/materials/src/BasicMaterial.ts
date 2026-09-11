import { Color, type ColorInput } from '@sekai64-internal/math'
import { Material, type MaterialOptions } from './Material.js'

export interface BasicMaterialOptions extends MaterialOptions { baseColor?: ColorInput }

export class BasicMaterial extends Material {
  readonly baseColor: Color
  constructor(options: BasicMaterialOptions = {}) {
    super(options)
    this.baseColor = Color.from(options.baseColor ?? '#ffffff')
  }
  setBaseColor(value: ColorInput): this { this.baseColor.set(value); this.markChanged(); return this }
}
