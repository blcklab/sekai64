import { Color, type ColorInput } from '@sekai64-internal/math'
import { Material, type MaterialOptions } from './Material.js'
import { Texture, type TextureLoadOptions, type TextureSource } from './Texture.js'

export type AlphaMode = 'opaque' | 'mask' | 'blend'
export type TextureInput = Texture | TextureSource
export type TextureCoordinateSet = 0 | 1
export type ShadingModel = 'pbr' | 'toon' | 'mtoon' | 'water'
export type CharacterMaterialRole = 'generic' | 'skin' | 'hair' | 'eye'
export type MToonOutlineWidthMode = 'none' | 'worldCoordinates' | 'screenCoordinates'

export interface ToonShadingOptions {
  shadeSteps?: number
  shadowColor?: ColorInput
  shadowStrength?: number
  highlightColor?: ColorInput
  highlightStrength?: number
  rimColor?: ColorInput
  rimStrength?: number
  rimPower?: number
  outlineColor?: ColorInput
  outlineStrength?: number
  outlinePower?: number
  /** Smooths band transitions without reverting to fully continuous Lambert lighting. */
  bandSmoothness?: number
  /** Shifts the light/shadow boundary in normalized lighting space. */
  shadowOffset?: number
  /** Amount of hemisphere/environment lighting mixed into the stylized result. */
  environmentMix?: number
}


export interface MToonShadingOptions {
  /** VRMC_materials_mtoon shadeColorFactor (authoring/UI color input). */
  shadeColor?: ColorInput
  /** VRMC_materials_mtoon shadeMultiplyTexture. */
  shadeTexture?: TextureInput
  shadeTexCoord?: TextureCoordinateSet
  shadingShift?: number
  /** VRMC_materials_mtoon shadingShiftTexture (R channel). */
  shadingShiftTexture?: TextureInput
  shadingShiftTexCoord?: TextureCoordinateSet
  shadingShiftTextureScale?: number
  shadingToony?: number
  giEqualization?: number
  /** VRMC_materials_mtoon matcapFactor and matcapTexture. */
  matcapColor?: ColorInput
  matcapTexture?: TextureInput
  matcapTexCoord?: TextureCoordinateSet
  parametricRimColor?: ColorInput
  /** VRMC_materials_mtoon rimMultiplyTexture. */
  rimTexture?: TextureInput
  rimTexCoord?: TextureCoordinateSet
  rimLightingMix?: number
  rimFresnelPower?: number
  rimLift?: number
  outlineWidthMode?: MToonOutlineWidthMode
  outlineWidth?: number
  outlineColor?: ColorInput
  outlineLightingMix?: number
  /** VRMC_materials_mtoon transparentWithZWrite. */
  transparentWithZWrite?: boolean
  /** VRMC_materials_mtoon renderQueueOffsetNumber. */
  renderQueueOffset?: number
  /** Optional Sekai64 character face-shadow mask; white keeps light, black receives shade. */
  faceShadowTexture?: TextureInput
  faceShadowTexCoord?: TextureCoordinateSet
  faceShadowStrength?: number
  faceShadowFlipX?: boolean
  /** Transparent hair can use stochastic coverage for stable bangs/eyelash ordering. */
  hairDepthWrite?: boolean
  hairAlphaDither?: boolean
  transparentSortBias?: number
  environmentMix?: number
  faceShadowSoftness?: number
  /** Amount of AO retained in MToon shading. 1 follows the source AO exactly. */
  occlusionMix?: number
}

export interface CharacterShadingOptions {
  role?: CharacterMaterialRole
  /** Wraps direct diffuse light around silhouettes; useful for soft anime skin. */
  softLighting?: number
  /** Small direct-light catchlight for eye/cornea materials. */
  eyeHighlightStrength?: number
  /** Tangent-aligned highlight for hair materials. */
  hairSpecularStrength?: number
  hairSpecularPower?: number
}

export interface WaterShadingOptions {
  shallowColor?: ColorInput
  deepColor?: ColorInput
  foamColor?: ColorInput
  fresnelPower?: number
  reflectionStrength?: number
  absorptionStrength?: number
}

export interface StandardMaterialOptions extends MaterialOptions {
  baseColor?: ColorInput
  baseColorTexture?: TextureInput
  baseColorTexCoord?: TextureCoordinateSet
  metallic?: number
  roughness?: number
  metallicRoughnessTexture?: TextureInput
  metallicRoughnessTexCoord?: TextureCoordinateSet
  metallicTexture?: TextureInput
  metallicTexCoord?: TextureCoordinateSet
  roughnessTexture?: TextureInput
  roughnessTexCoord?: TextureCoordinateSet
  normalTexture?: TextureInput
  normalTexCoord?: TextureCoordinateSet
  normalScale?: number
  emissive?: ColorInput
  emissiveIntensity?: number
  emissiveTexture?: TextureInput
  emissiveTexCoord?: TextureCoordinateSet
  occlusionTexture?: TextureInput
  occlusionTexCoord?: TextureCoordinateSet
  occlusionStrength?: number
  lightMapTexture?: TextureInput
  lightMapTexCoord?: TextureCoordinateSet
  lightMapIntensity?: number
  specularFactor?: number
  specularColor?: ColorInput
  clearcoat?: number
  clearcoatRoughness?: number
  sheenColor?: ColorInput
  sheenIntensity?: number
  sheenRoughness?: number
  transmission?: number
  ior?: number
  thickness?: number
  attenuationColor?: ColorInput
  attenuationDistance?: number
  alphaMode?: AlphaMode
  alphaCutoff?: number
  /** Screen-door alpha dithering for masked foliage and hair cards. */
  alphaDither?: boolean
  ownsTextures?: boolean
  autoloadTextures?: boolean
  textureLoadOptions?: TextureLoadOptions
  shadingModel?: ShadingModel
  toon?: ToonShadingOptions
  mtoon?: MToonShadingOptions
  character?: CharacterShadingOptions
  water?: WaterShadingOptions
}

export class StandardMaterial extends Material {
  readonly baseColor: Color
  readonly emissive: Color
  baseColorTexture?: Texture
  metallicRoughnessTexture?: Texture
  metallicTexture?: Texture
  roughnessTexture?: Texture
  normalTexture?: Texture
  emissiveTexture?: Texture
  occlusionTexture?: Texture
  lightMapTexture?: Texture
  faceShadowTexture?: Texture
  mtoonShadeTexture?: Texture
  mtoonShadingShiftTexture?: Texture
  mtoonMatcapTexture?: Texture
  mtoonRimTexture?: Texture
  baseColorTexCoord: TextureCoordinateSet
  metallicRoughnessTexCoord: TextureCoordinateSet
  metallicTexCoord: TextureCoordinateSet
  roughnessTexCoord: TextureCoordinateSet
  normalTexCoord: TextureCoordinateSet
  emissiveTexCoord: TextureCoordinateSet
  occlusionTexCoord: TextureCoordinateSet
  lightMapTexCoord: TextureCoordinateSet
  faceShadowTexCoord: TextureCoordinateSet
  mtoonShadeTexCoord: TextureCoordinateSet
  mtoonShadingShiftTexCoord: TextureCoordinateSet
  mtoonMatcapTexCoord: TextureCoordinateSet
  mtoonRimTexCoord: TextureCoordinateSet
  metallic: number
  roughness: number
  normalScale: number
  emissiveIntensity: number
  occlusionStrength: number
  lightMapIntensity: number
  specularFactor: number
  clearcoat: number
  clearcoatRoughness: number
  sheenIntensity: number
  sheenRoughness: number
  transmission: number
  ior: number
  thickness: number
  attenuationDistance: number
  readonly attenuationColor: Color
  readonly specularColor: Color
  readonly sheenColor: Color
  readonly waterShallowColor: Color
  readonly waterDeepColor: Color
  readonly waterFoamColor: Color
  readonly toonShadowColor: Color
  readonly toonHighlightColor: Color
  readonly toonRimColor: Color
  readonly toonOutlineColor: Color
  readonly mtoonShadeColor: Color
  readonly mtoonRimColor: Color
  readonly mtoonOutlineColor: Color
  readonly mtoonMatcapColor: Color
  shadingModel: ShadingModel
  toonShadeSteps: number
  toonShadowStrength: number
  toonHighlightStrength: number
  toonRimStrength: number
  toonRimPower: number
  toonOutlineStrength: number
  toonOutlinePower: number
  toonBandSmoothness: number
  toonShadowOffset: number
  toonEnvironmentMix: number
  mtoonShadingShift: number
  mtoonShadingToony: number
  mtoonGiEqualization: number
  mtoonRimLightingMix: number
  mtoonRimFresnelPower: number
  mtoonRimLift: number
  mtoonOutlineWidth: number
  mtoonOutlineLightingMix: number
  mtoonOutlineWidthMode: MToonOutlineWidthMode
  mtoonShadingShiftTextureScale: number
  mtoonTransparentWithZWrite: boolean
  mtoonOcclusionMix: number
  characterRole: CharacterMaterialRole
  characterSoftLighting: number
  characterEyeHighlightStrength: number
  characterHairSpecularStrength: number
  characterHairSpecularPower: number
  mtoonFaceShadowStrength: number
  mtoonFaceShadowFlipX: boolean
  mtoonHairAlphaDither: boolean
  mtoonEnvironmentMix: number
  mtoonFaceShadowSoftness: number
  waterFresnelPower: number
  waterReflectionStrength: number
  waterAbsorptionStrength: number
  alphaDither: boolean
  alphaMode: AlphaMode
  alphaCutoff: number
  ownsTextures: boolean
  private readonly ownedTextures = new Set<Texture>()
  private readiness: Promise<this>

  constructor(options: StandardMaterialOptions = {}) {
    const alphaMode = options.alphaMode ?? (options.transparent ? 'blend' : 'opaque')
    const characterRole = options.character?.role ?? 'generic'
    const transparentWithZWrite = options.mtoon?.transparentWithZWrite ?? options.mtoon?.hairDepthWrite ?? false
    const renderQueueOffset = options.mtoon?.renderQueueOffset ?? options.mtoon?.transparentSortBias
    super({ ...options, transparent: alphaMode === 'blend', depthWrite: options.depthWrite ?? (alphaMode === 'blend' ? transparentWithZWrite : true), sortBias: renderQueueOffset ?? options.sortBias })
    this.baseColor = Color.from(options.baseColor ?? '#ffffff')
    this.emissive = Color.from(options.emissive ?? '#000000')
    this.attenuationColor = Color.from(options.attenuationColor ?? '#ffffff')
    this.specularColor = Color.from(options.specularColor ?? '#ffffff')
    this.sheenColor = Color.from(options.sheenColor ?? '#ffffff')
    this.waterShallowColor = Color.from(options.water?.shallowColor ?? options.baseColor ?? '#55b8d6')
    this.waterDeepColor = Color.from(options.water?.deepColor ?? options.attenuationColor ?? '#0a3f67')
    this.waterFoamColor = Color.from(options.water?.foamColor ?? '#e8fbff')
    this.toonShadowColor = Color.from(options.toon?.shadowColor ?? '#66708f')
    this.toonHighlightColor = Color.from(options.toon?.highlightColor ?? '#fff4df')
    this.toonRimColor = Color.from(options.toon?.rimColor ?? '#ffd7e8')
    this.toonOutlineColor = Color.from(options.toon?.outlineColor ?? '#201a2a')
    this.mtoonShadeColor = Color.from(options.mtoon?.shadeColor ?? '#000000')
    this.mtoonRimColor = Color.from(options.mtoon?.parametricRimColor ?? '#000000')
    this.mtoonOutlineColor = Color.from(options.mtoon?.outlineColor ?? '#000000')
    this.mtoonMatcapColor = Color.from(options.mtoon?.matcapColor ?? '#ffffff')
    this.baseColorTexture = this.createTexture(options.baseColorTexture, 'base-color', options.ownsTextures)
    this.metallicRoughnessTexture = this.createTexture(options.metallicRoughnessTexture, 'metallic-roughness', options.ownsTextures)
    this.metallicTexture = this.createTexture(options.metallicTexture, 'metallic', options.ownsTextures)
    this.roughnessTexture = this.createTexture(options.roughnessTexture, 'roughness', options.ownsTextures)
    this.normalTexture = this.createTexture(options.normalTexture, 'normal', options.ownsTextures)
    this.emissiveTexture = this.createTexture(options.emissiveTexture, 'emissive', options.ownsTextures)
    this.occlusionTexture = this.createTexture(options.occlusionTexture, 'occlusion', options.ownsTextures)
    this.lightMapTexture = this.createTexture(options.lightMapTexture, 'light-map', options.ownsTextures)
    this.faceShadowTexture = this.createTexture(options.mtoon?.faceShadowTexture, 'mtoon-face-shadow', options.ownsTextures)
    this.mtoonShadeTexture = this.createTexture(options.mtoon?.shadeTexture, 'mtoon-shade', options.ownsTextures)
    this.mtoonShadingShiftTexture = this.createTexture(options.mtoon?.shadingShiftTexture, 'mtoon-shading-shift', options.ownsTextures)
    this.mtoonMatcapTexture = this.createTexture(options.mtoon?.matcapTexture, 'mtoon-matcap', options.ownsTextures)
    this.mtoonRimTexture = this.createTexture(options.mtoon?.rimTexture, 'mtoon-rim', options.ownsTextures)
    this.baseColorTexCoord = toTexCoord(options.baseColorTexCoord)
    this.metallicRoughnessTexCoord = toTexCoord(options.metallicRoughnessTexCoord)
    this.metallicTexCoord = toTexCoord(options.metallicTexCoord)
    this.roughnessTexCoord = toTexCoord(options.roughnessTexCoord)
    this.normalTexCoord = toTexCoord(options.normalTexCoord)
    this.emissiveTexCoord = toTexCoord(options.emissiveTexCoord)
    this.occlusionTexCoord = toTexCoord(options.occlusionTexCoord)
    this.lightMapTexCoord = toTexCoord(options.lightMapTexCoord ?? 1)
    this.faceShadowTexCoord = toTexCoord(options.mtoon?.faceShadowTexCoord)
    this.mtoonShadeTexCoord = toTexCoord(options.mtoon?.shadeTexCoord)
    this.mtoonShadingShiftTexCoord = toTexCoord(options.mtoon?.shadingShiftTexCoord)
    this.mtoonMatcapTexCoord = toTexCoord(options.mtoon?.matcapTexCoord)
    this.mtoonRimTexCoord = toTexCoord(options.mtoon?.rimTexCoord)
    this.ownsTextures = this.ownedTextures.size > 0
    this.metallic = clamp01(options.metallic ?? 0)
    this.roughness = clamp01(options.roughness ?? 1)
    this.normalScale = Number.isFinite(options.normalScale) ? Math.max(0, options.normalScale ?? 1) : 1
    this.emissiveIntensity = Math.max(0, options.emissiveIntensity ?? 1)
    this.occlusionStrength = clamp01(options.occlusionStrength ?? 1)
    this.lightMapIntensity = Math.max(0, options.lightMapIntensity ?? 1)
    this.specularFactor = clamp01(options.specularFactor ?? 1)
    this.clearcoat = clamp01(options.clearcoat ?? 0)
    this.clearcoatRoughness = clampRange(options.clearcoatRoughness ?? 0.1, 0.045, 1)
    this.sheenIntensity = clamp01(options.sheenIntensity ?? (options.sheenColor ? 1 : 0))
    this.sheenRoughness = clamp01(options.sheenRoughness ?? 0.5)
    this.transmission = clamp01(options.transmission ?? 0)
    this.ior = Math.max(1, Math.min(2.5, options.ior ?? 1.5))
    this.thickness = Math.max(0, options.thickness ?? 0)
    this.attenuationDistance = Number.isFinite(options.attenuationDistance) ? Math.max(0.0001, options.attenuationDistance ?? 1) : 1
    this.shadingModel = options.shadingModel ?? 'pbr'
    this.toonShadeSteps = clampRange(options.toon?.shadeSteps ?? 3, 2, 8)
    this.toonShadowStrength = clamp01(options.toon?.shadowStrength ?? 0.58)
    this.toonHighlightStrength = clamp01(options.toon?.highlightStrength ?? 0.2)
    this.toonRimStrength = clamp01(options.toon?.rimStrength ?? 0.18)
    this.toonRimPower = clampRange(options.toon?.rimPower ?? 2.5, 0.5, 12)
    this.toonOutlineStrength = clamp01(options.toon?.outlineStrength ?? 0.68)
    this.toonOutlinePower = clampRange(options.toon?.outlinePower ?? 5, 1, 16)
    this.toonBandSmoothness = clamp01(options.toon?.bandSmoothness ?? 0.08)
    this.toonShadowOffset = clampRange(options.toon?.shadowOffset ?? 0, -1, 1)
    this.toonEnvironmentMix = clamp01(options.toon?.environmentMix ?? 0.18)
    this.mtoonShadingShift = clampRange(options.mtoon?.shadingShift ?? 0, -1, 1)
    this.mtoonShadingShiftTextureScale = clampRange(options.mtoon?.shadingShiftTextureScale ?? 1, -4, 4)
    this.mtoonShadingToony = clamp01(options.mtoon?.shadingToony ?? 0.9)
    this.mtoonGiEqualization = clamp01(options.mtoon?.giEqualization ?? 0.9)
    this.mtoonRimLightingMix = clamp01(options.mtoon?.rimLightingMix ?? 1)
    this.mtoonRimFresnelPower = clampRange(options.mtoon?.rimFresnelPower ?? 5, 0.0001, 100)
    this.mtoonRimLift = clampRange(options.mtoon?.rimLift ?? 0, -1, 1)
    this.mtoonOutlineWidthMode = options.mtoon?.outlineWidthMode ?? 'none'
    this.mtoonOutlineWidth = this.mtoonOutlineWidthMode === 'none' ? 0 : clampRange(options.mtoon?.outlineWidth ?? 0, 0, 0.1)
    this.mtoonOutlineLightingMix = clamp01(options.mtoon?.outlineLightingMix ?? 1)
    this.mtoonTransparentWithZWrite = transparentWithZWrite
    this.mtoonOcclusionMix = clamp01(options.mtoon?.occlusionMix ?? (characterRole === 'skin' ? 0.35 : 1))
    this.characterRole = characterRole
    this.characterSoftLighting = clamp01(options.character?.softLighting ?? (characterRole === 'skin' ? 0.28 : characterRole === 'eye' ? 0.12 : 0.08))
    this.characterEyeHighlightStrength = clamp01(options.character?.eyeHighlightStrength ?? (characterRole === 'eye' ? 0.22 : 0))
    this.characterHairSpecularStrength = clamp01(options.character?.hairSpecularStrength ?? (characterRole === 'hair' ? 0.16 : 0))
    this.characterHairSpecularPower = clampRange(options.character?.hairSpecularPower ?? 18, 2, 128)
    this.mtoonFaceShadowStrength = clamp01(options.mtoon?.faceShadowStrength ?? 0.75)
    this.mtoonFaceShadowFlipX = options.mtoon?.faceShadowFlipX ?? false
    this.mtoonHairAlphaDither = options.mtoon?.hairAlphaDither ?? (alphaMode === 'blend' && characterRole === 'hair')
    this.mtoonEnvironmentMix = clamp01(options.mtoon?.environmentMix ?? 0.12)
    this.mtoonFaceShadowSoftness = clamp01(options.mtoon?.faceShadowSoftness ?? 0.08)
    this.waterFresnelPower = clampRange(options.water?.fresnelPower ?? 5, 0.5, 16)
    this.waterReflectionStrength = clamp01(options.water?.reflectionStrength ?? 0.78)
    this.waterAbsorptionStrength = Math.max(0, options.water?.absorptionStrength ?? 1)
    this.alphaDither = options.alphaDither ?? false
    this.alphaMode = alphaMode
    this.alphaCutoff = clamp01(options.alphaCutoff ?? 0.5)
    this.readiness = Promise.resolve(this)
    if (options.autoloadTextures ?? false) this.startTextureLoading(options.textureLoadOptions)
  }

  static async create(options: StandardMaterialOptions = {}): Promise<StandardMaterial> {
    const material = new StandardMaterial({ ...options, autoloadTextures: false })
    await material.loadTextures(options.textureLoadOptions)
    return material
  }

  get ready(): Promise<this> { return this.readiness }

  setBaseColor(value: ColorInput): this { this.baseColor.set(value); this.markChanged(); return this }
  setMetallic(value: number): this { this.metallic = clamp01(value); this.markChanged(); return this }
  setRoughness(value: number): this { this.roughness = clamp01(value); this.markChanged(); return this }
  setEmissive(value: ColorInput, intensity = this.emissiveIntensity): this { this.emissive.set(value); this.emissiveIntensity = Math.max(0, intensity); this.markChanged(); return this }

  setBaseColorTexture(value?: TextureInput, ownsTexture = !(value instanceof Texture), autoload = false): this {
    this.replaceTexture('baseColorTexture', value, 'base-color', ownsTexture, autoload)
    return this
  }

  setNormalTexture(value?: TextureInput, ownsTexture = !(value instanceof Texture), autoload = false): this {
    this.replaceTexture('normalTexture', value, 'normal', ownsTexture, autoload)
    return this
  }

  loadTextures(options: TextureLoadOptions = {}): Promise<this> {
    this.assertAlive()
    return this.startTextureLoading(options)
  }

  protected override release(): void {
    for (const texture of this.ownedTextures) texture.dispose()
    this.ownedTextures.clear()
    super.release()
  }

  private createTexture(value: TextureInput | undefined, label: string, ownsTextures: boolean | undefined): Texture | undefined {
    if (value === undefined) return undefined
    const texture = value instanceof Texture ? value : new Texture({ source: value, label })
    const owns = ownsTextures ?? !(value instanceof Texture)
    if (owns) this.ownedTextures.add(texture)
    return texture
  }

  private replaceTexture(key: 'baseColorTexture' | 'metallicRoughnessTexture' | 'metallicTexture' | 'roughnessTexture' | 'normalTexture' | 'emissiveTexture' | 'occlusionTexture' | 'lightMapTexture' | 'faceShadowTexture' | 'mtoonShadeTexture' | 'mtoonShadingShiftTexture' | 'mtoonMatcapTexture' | 'mtoonRimTexture', value: TextureInput | undefined, label: string, ownsTexture: boolean, autoload: boolean): void {
    this.assertAlive()
    const previous = this[key]
    if (previous && this.ownedTextures.delete(previous)) previous.dispose()
    const texture = value === undefined ? undefined : value instanceof Texture ? value : new Texture({ source: value, label })
    this[key] = texture
    if (texture && ownsTexture) this.ownedTextures.add(texture)
    this.ownsTextures = this.ownedTextures.size > 0
    if (autoload) this.startTextureLoading()
    this.markChanged()
  }

  private startTextureLoading(options: TextureLoadOptions = {}): Promise<this> {
    const textures = [...new Set([
      this.baseColorTexture,
      this.metallicRoughnessTexture,
      this.metallicTexture,
      this.roughnessTexture,
      this.normalTexture,
      this.emissiveTexture,
      this.occlusionTexture,
      this.lightMapTexture,
      this.faceShadowTexture,
      this.mtoonShadeTexture,
      this.mtoonShadingShiftTexture,
      this.mtoonMatcapTexture,
      this.mtoonRimTexture
    ].filter((value): value is Texture => value !== undefined))]
    const pending = textures.filter(texture => !texture.ready).map(texture => texture.load(options))
    this.readiness = pending.length === 0 ? Promise.resolve(this) : Promise.all(pending).then(() => this)
    void this.readiness.catch(() => undefined)
    return this.readiness
  }
}

function toTexCoord(value: TextureCoordinateSet | undefined): TextureCoordinateSet { return value === 1 ? 1 : 0 }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }
function clampRange(value: number, min: number, max: number): number { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min }
