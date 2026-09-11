import { validateColorLut, type RendererColorLut } from './ColorLut.js'

export type ToneMappingMode = 'none' | 'reinhard' | 'aces' | 'neutral'
export type OutputColorSpace = 'srgb' | 'linear'
export type RendererAntiAliasingMode = 'none' | 'fxaa' | 'fxaa-high'
export type RendererSsaoMode = 'contact' | 'gtao'
export type RendererOutlineMode = 'screen-space' | 'inverted-hull' | 'hybrid'
export type RendererShadowFilter = 'hard' | 'pcf3' | 'pcf5' | 'poisson'

export interface RendererColorManagement {
  toneMapping: ToneMappingMode
  exposure: number
  outputColorSpace: OutputColorSpace
}

export interface RendererEnvironmentLighting {
  enabled: boolean
  skyColor: readonly [number, number, number]
  groundColor: readonly [number, number, number]
  intensity: number
  specularIntensity: number
  /** Rotation of the equirectangular environment around the vertical axis, in radians. */
  rotation: number
}

export interface RendererShadowOptions {
  enabled: boolean
  mapSize: number
  bias: number
  normalBias: number
  softness: number
  cameraPadding: number
  /** Directional shadow cascades. Backends may gracefully reduce this under device limits. */
  cascades: number
  maxDistance: number
  splitLambda: number
  stabilize: boolean
  casterDistance: number
  /** Filtering kernel used by directional shadows. */
  filter: RendererShadowFilter
  /** Fraction of each cascade blended into the next cascade. */
  cascadeBlend: number
  /** Fraction of maxDistance used to fade shadows to fully lit. */
  distanceFade: number
}

export interface RendererImageQuality {
  dithering: boolean
  maxAnisotropy: number
  /** Internal rendering scale, independent from CSS size. */
  renderScale: number
  /** Requested MSAA sample count. Backends clamp to supported values. */
  msaaSamples: 1 | 2 | 4
  mipmaps: boolean
  /** Post-resolve edge antialiasing. FXAA is useful when depth cannot be multisample-resolved. */
  antialiasing: RendererAntiAliasingMode
  /** Mild post-AA sharpening. */
  sharpen: number
}

export type RendererFogMode = 'none' | 'linear' | 'exp2'

export interface RendererAtmosphere {
  enabled: boolean
  mode: RendererFogMode
  color: readonly [number, number, number]
  near: number
  far: number
  density: number
  baseHeight: number
  heightFalloff: number
  maxOpacity: number
}

export interface RendererColorGrading {
  enabled: boolean
  saturation: number
  contrast: number
  brightness: number
  temperature: number
  tint: number
  vignette: number
  vignetteSoftness: number
  highlightGlow: number
  highlightThreshold: number
  /** Optional production 3D LUT applied in the final GPU composite pass. */
  lut?: RendererColorLut
  /** Blend between the ungraded image and LUT output. */
  lutIntensity: number
}

export interface RendererSsaoOptions {
  enabled: boolean
  mode: RendererSsaoMode
  radius: number
  intensity: number
  bias: number
  samples: number
  halfResolution: boolean
  /** Bilateral depth-aware denoising. */
  denoise: boolean
  denoiseRadius: number
  /** Number of angular horizon directions used by GTAO. */
  directions: number
}

export interface RendererBloomOptions {
  enabled: boolean
  strength: number
  threshold: number
  radius: number
  levels: number
  /** Energy shared between adjacent downsample levels. */
  scatter: number
  /** Caps unstable HDR spikes before convolution. */
  clamp: number
}

export interface RendererOutlineOptions {
  enabled: boolean
  mode: RendererOutlineMode
  color: readonly [number, number, number]
  thickness: number
  depthThreshold: number
  normalThreshold: number
  charactersOnly: boolean
}

/** Backend-neutral GPU post-process plan. */
export interface RendererPostProcessing {
  enabled: boolean
  ssao: RendererSsaoOptions
  bloom: RendererBloomOptions
  outlines: RendererOutlineOptions
}

export interface RendererOptimizationOptions {
  frustumCulling: boolean
  cachedBounds: boolean
  pipelineSorting: boolean
  shadowCasterCulling: boolean
  lodHysteresis: number
  /** Conservative previous-frame hierarchical bounds-depth culling. */
  hizOcclusion: boolean
  hizResolution: number
  /** Consecutive occluded frames required before rejecting a mesh. */
  occlusionHistoryFrames: number
  occlusionMinimumPixels: number
  /** CPU-built forward+ clusters used to choose local lights per draw. */
  clusteredLighting: boolean
  clusterDimensions: readonly [number, number, number]
  maxLightsPerCluster: number
  maxClusteredLights: number
  /** Allows loaders/adapters to merge repeated static primitives into instances. */
  staticBatching: boolean
  staticBatchMinInstances: number
  /** Soft GPU texture and geometry residency budgets. Zero disables eviction. */
  textureMemoryBudgetMB: number
  textureEvictionFrames: number
  geometryMemoryBudgetMB: number
  geometryEvictionFrames: number
  /** Renderer-neutral large-world policies; applications provide region loaders. */
  regionStreaming: boolean
  streamingLoadDistance: number
  streamingUnloadDistance: number
  streamingConcurrency: number
  worldOriginRebasing: boolean
  worldOriginThreshold: number
  worldOriginGridSize: number
}

export interface ShadowCascadeSplit {
  index: number
  near: number
  far: number
}

export const DEFAULT_COLOR_MANAGEMENT: Readonly<RendererColorManagement> = Object.freeze({
  toneMapping: 'aces', exposure: 1, outputColorSpace: 'srgb',
})

export const DEFAULT_ENVIRONMENT_LIGHTING: Readonly<RendererEnvironmentLighting> = Object.freeze({
  enabled: true, skyColor: [0.18, 0.22, 0.3] as const, groundColor: [0.025, 0.03, 0.04] as const,
  intensity: 0.35, specularIntensity: 1, rotation: 0,
})

export const DEFAULT_SHADOW_OPTIONS: Readonly<RendererShadowOptions> = Object.freeze({
  enabled: true, mapSize: 1024, bias: 0.0008, normalBias: 0.015, softness: 1, cameraPadding: 2,
  cascades: 1, maxDistance: 140, splitLambda: 0.65, stabilize: true, casterDistance: 180, filter: 'pcf3', cascadeBlend: 0.12, distanceFade: 0.12,
})

export const DEFAULT_IMAGE_QUALITY: Readonly<RendererImageQuality> = Object.freeze({
  dithering: true, maxAnisotropy: 4, renderScale: 1, msaaSamples: 4, mipmaps: true,
  antialiasing: 'fxaa', sharpen: 0.08,
})

export const DEFAULT_ATMOSPHERE: Readonly<RendererAtmosphere> = Object.freeze({
  enabled: false, mode: 'none', color: [0.62, 0.76, 0.86] as const, near: 24, far: 180,
  density: 0.012, baseHeight: 0, heightFalloff: 0, maxOpacity: 0.82,
})

export const DEFAULT_COLOR_GRADING: Readonly<RendererColorGrading> = Object.freeze({
  enabled: false, saturation: 1, contrast: 1, brightness: 0, temperature: 0, tint: 0,
  vignette: 0, vignetteSoftness: 0.45, highlightGlow: 0, highlightThreshold: 0.78,
  lutIntensity: 1,
})

export const DEFAULT_POST_PROCESSING: Readonly<RendererPostProcessing> = Object.freeze({
  enabled: false,
  ssao: Object.freeze({ enabled: false, mode: 'gtao', radius: 0.65, intensity: 0.85, bias: 0.018, samples: 12, halfResolution: true, denoise: true, denoiseRadius: 2, directions: 4 }),
  bloom: Object.freeze({ enabled: false, strength: 0.12, threshold: 0.82, radius: 0.7, levels: 4, scatter: 0.7, clamp: 8 }),
  outlines: Object.freeze({ enabled: false, mode: 'hybrid', color: [0.08, 0.065, 0.11] as const, thickness: 1, depthThreshold: 0.0035, normalThreshold: 0.25, charactersOnly: true }),
})

export interface RendererVisualQualityPreset {
  colorManagement: Readonly<RendererColorManagement>
  environmentLighting: Readonly<RendererEnvironmentLighting>
  shadows: Readonly<RendererShadowOptions>
  imageQuality: Readonly<RendererImageQuality>
  postProcessing?: Readonly<RendererPostProcessing>
}

/** High-fidelity preset tuned for product visualization and close-up PBR assets. */
export const PRODUCT_VISUAL_PRESET: Readonly<RendererVisualQualityPreset> = Object.freeze({
  colorManagement: Object.freeze({ toneMapping: 'neutral', exposure: 0.9, outputColorSpace: 'srgb' }),
  environmentLighting: Object.freeze({
    enabled: true,
    skyColor: [0.82, 0.84, 0.88] as const,
    groundColor: [0.24, 0.25, 0.28] as const,
    intensity: 0.58,
    specularIntensity: 1,
    rotation: 0,
  }),
  shadows: Object.freeze({
    ...DEFAULT_SHADOW_OPTIONS,
    mapSize: 2048,
    cascades: 2,
    filter: 'pcf5',
    softness: 0.85,
    cascadeBlend: 0.16,
  }),
  imageQuality: Object.freeze({
    ...DEFAULT_IMAGE_QUALITY,
    maxAnisotropy: 16,
    renderScale: 1.15,
    msaaSamples: 4,
    antialiasing: 'fxaa',
    sharpen: 0.05,
  }),
})


/** Character/VRM preset tuned for clean anime faces, hair edges and close inspection. */
export const CHARACTER_VISUAL_PRESET: Readonly<RendererVisualQualityPreset> = Object.freeze({
  colorManagement: Object.freeze({ toneMapping: 'neutral', exposure: 0.94, outputColorSpace: 'srgb' }),
  environmentLighting: Object.freeze({
    enabled: true,
    skyColor: [0.78, 0.8, 0.84] as const,
    groundColor: [0.3, 0.3, 0.32] as const,
    intensity: 0.64,
    specularIntensity: 0.88,
    rotation: 0,
  }),
  shadows: Object.freeze({
    ...DEFAULT_SHADOW_OPTIONS,
    mapSize: 2048,
    cascades: 2,
    filter: 'pcf5',
    normalBias: 0.01,
    softness: 1.05,
    cascadeBlend: 0.18,
  }),
  imageQuality: Object.freeze({
    ...DEFAULT_IMAGE_QUALITY,
    maxAnisotropy: 16,
    renderScale: 1.25,
    msaaSamples: 4,
    antialiasing: 'fxaa-high',
    sharpen: 0.045,
  }),
  postProcessing: Object.freeze({
    enabled: true,
    ssao: Object.freeze({ ...DEFAULT_POST_PROCESSING.ssao, enabled: false }),
    bloom: Object.freeze({ ...DEFAULT_POST_PROCESSING.bloom, enabled: false }),
    outlines: Object.freeze({ ...DEFAULT_POST_PROCESSING.outlines, enabled: true, mode: 'inverted-hull', charactersOnly: true, thickness: 1 }),
  }),
})

export const DEFAULT_OPTIMIZATION: Readonly<RendererOptimizationOptions> = Object.freeze({
  frustumCulling: true,
  cachedBounds: true,
  pipelineSorting: true,
  shadowCasterCulling: true,
  lodHysteresis: 0.08,
  hizOcclusion: false,
  hizResolution: 64,
  occlusionHistoryFrames: 2,
  occlusionMinimumPixels: 3,
  clusteredLighting: true,
  clusterDimensions: [16, 9, 24] as const,
  maxLightsPerCluster: 8,
  maxClusteredLights: 1024,
  staticBatching: true,
  staticBatchMinInstances: 3,
  textureMemoryBudgetMB: 384,
  textureEvictionFrames: 180,
  geometryMemoryBudgetMB: 512,
  geometryEvictionFrames: 300,
  regionStreaming: false,
  streamingLoadDistance: 160,
  streamingUnloadDistance: 220,
  streamingConcurrency: 4,
  worldOriginRebasing: false,
  worldOriginThreshold: 10000,
  worldOriginGridSize: 1000,
})

export function resolveColorManagement(value: Partial<RendererColorManagement> = {}): RendererColorManagement {
  return { toneMapping: value.toneMapping ?? DEFAULT_COLOR_MANAGEMENT.toneMapping, exposure: finiteAtLeast(value.exposure, DEFAULT_COLOR_MANAGEMENT.exposure, 0), outputColorSpace: value.outputColorSpace ?? DEFAULT_COLOR_MANAGEMENT.outputColorSpace }
}

export function resolveEnvironmentLighting(value: Partial<RendererEnvironmentLighting> = {}): RendererEnvironmentLighting {
  return {
    enabled: value.enabled ?? DEFAULT_ENVIRONMENT_LIGHTING.enabled,
    skyColor: colorTriplet(value.skyColor, DEFAULT_ENVIRONMENT_LIGHTING.skyColor),
    groundColor: colorTriplet(value.groundColor, DEFAULT_ENVIRONMENT_LIGHTING.groundColor),
    intensity: finiteAtLeast(value.intensity, DEFAULT_ENVIRONMENT_LIGHTING.intensity, 0),
    specularIntensity: finiteAtLeast(value.specularIntensity, DEFAULT_ENVIRONMENT_LIGHTING.specularIntensity, 0),
    rotation: Number.isFinite(value.rotation) ? value.rotation as number : DEFAULT_ENVIRONMENT_LIGHTING.rotation,
  }
}

export function resolveShadowOptions(value: Partial<RendererShadowOptions> = {}): RendererShadowOptions {
  const requested = finiteAtLeast(value.mapSize, DEFAULT_SHADOW_OPTIONS.mapSize, 64)
  return {
    enabled: value.enabled ?? DEFAULT_SHADOW_OPTIONS.enabled,
    mapSize: nearestPowerOfTwo(Math.min(4096, requested)),
    bias: finiteAtLeast(value.bias, DEFAULT_SHADOW_OPTIONS.bias, 0),
    normalBias: finiteAtLeast(value.normalBias, DEFAULT_SHADOW_OPTIONS.normalBias, 0),
    softness: Math.min(3, finiteAtLeast(value.softness, DEFAULT_SHADOW_OPTIONS.softness, 0)),
    cameraPadding: finiteAtLeast(value.cameraPadding, DEFAULT_SHADOW_OPTIONS.cameraPadding, 0),
    cascades: Math.max(1, Math.min(4, Math.floor(finiteAtLeast(value.cascades, DEFAULT_SHADOW_OPTIONS.cascades, 1)))),
    maxDistance: finiteAtLeast(value.maxDistance, DEFAULT_SHADOW_OPTIONS.maxDistance, 1),
    splitLambda: clampFinite(value.splitLambda, DEFAULT_SHADOW_OPTIONS.splitLambda, 0, 1),
    stabilize: value.stabilize ?? DEFAULT_SHADOW_OPTIONS.stabilize,
    casterDistance: finiteAtLeast(value.casterDistance, DEFAULT_SHADOW_OPTIONS.casterDistance, 1),
    filter: value.filter ?? DEFAULT_SHADOW_OPTIONS.filter,
    cascadeBlend: clampFinite(value.cascadeBlend, DEFAULT_SHADOW_OPTIONS.cascadeBlend, 0, 0.49),
    distanceFade: clampFinite(value.distanceFade, DEFAULT_SHADOW_OPTIONS.distanceFade, 0, 0.9),
  }
}

export function resolveImageQuality(value: Partial<RendererImageQuality> = {}): RendererImageQuality {
  const requestedSamples = value.msaaSamples ?? DEFAULT_IMAGE_QUALITY.msaaSamples
  const msaaSamples: 1 | 2 | 4 = requestedSamples >= 4 ? 4 : requestedSamples >= 2 ? 2 : 1
  return {
    dithering: value.dithering ?? DEFAULT_IMAGE_QUALITY.dithering,
    maxAnisotropy: Math.max(1, Math.min(16, Math.floor(finiteAtLeast(value.maxAnisotropy, DEFAULT_IMAGE_QUALITY.maxAnisotropy, 1)))),
    renderScale: clampFinite(value.renderScale, DEFAULT_IMAGE_QUALITY.renderScale, 0.5, 1.5),
    msaaSamples,
    mipmaps: value.mipmaps ?? DEFAULT_IMAGE_QUALITY.mipmaps,
    antialiasing: value.antialiasing ?? DEFAULT_IMAGE_QUALITY.antialiasing,
    sharpen: clampFinite(value.sharpen, DEFAULT_IMAGE_QUALITY.sharpen, 0, 1),
  }
}

export function resolveAtmosphere(value: Partial<RendererAtmosphere> = {}): RendererAtmosphere {
  const mode = value.mode ?? DEFAULT_ATMOSPHERE.mode
  const near = finiteAtLeast(value.near, DEFAULT_ATMOSPHERE.near, 0)
  const far = Math.max(near + 0.001, finiteAtLeast(value.far, DEFAULT_ATMOSPHERE.far, 0.001))
  return { enabled: value.enabled ?? (mode !== 'none'), mode, color: colorTriplet(value.color, DEFAULT_ATMOSPHERE.color), near, far, density: finiteAtLeast(value.density, DEFAULT_ATMOSPHERE.density, 0), baseHeight: Number.isFinite(value.baseHeight) ? value.baseHeight as number : DEFAULT_ATMOSPHERE.baseHeight, heightFalloff: finiteAtLeast(value.heightFalloff, DEFAULT_ATMOSPHERE.heightFalloff, 0), maxOpacity: clampFinite(value.maxOpacity, DEFAULT_ATMOSPHERE.maxOpacity, 0, 1) }
}

export function resolveColorGrading(value: Partial<RendererColorGrading> = {}): RendererColorGrading {
  if (value.lut) validateColorLut(value.lut)
  return { enabled: value.enabled ?? DEFAULT_COLOR_GRADING.enabled, saturation: clampFinite(value.saturation, DEFAULT_COLOR_GRADING.saturation, 0, 2), contrast: clampFinite(value.contrast, DEFAULT_COLOR_GRADING.contrast, 0, 2), brightness: clampFinite(value.brightness, DEFAULT_COLOR_GRADING.brightness, -1, 1), temperature: clampFinite(value.temperature, DEFAULT_COLOR_GRADING.temperature, -1, 1), tint: clampFinite(value.tint, DEFAULT_COLOR_GRADING.tint, -1, 1), vignette: clampFinite(value.vignette, DEFAULT_COLOR_GRADING.vignette, 0, 1), vignetteSoftness: clampFinite(value.vignetteSoftness, DEFAULT_COLOR_GRADING.vignetteSoftness, 0.05, 1), highlightGlow: clampFinite(value.highlightGlow, DEFAULT_COLOR_GRADING.highlightGlow, 0, 2), highlightThreshold: clampFinite(value.highlightThreshold, DEFAULT_COLOR_GRADING.highlightThreshold, 0, 1), ...(value.lut ? { lut: value.lut } : {}), lutIntensity: clampFinite(value.lutIntensity, DEFAULT_COLOR_GRADING.lutIntensity, 0, 1) }
}

export function resolvePostProcessing(value: Partial<RendererPostProcessing> = {}): RendererPostProcessing {
  const ssao: Partial<RendererSsaoOptions> = value.ssao ?? {}
  const bloom: Partial<RendererBloomOptions> = value.bloom ?? {}
  const outlines: Partial<RendererOutlineOptions> = value.outlines ?? {}
  const resolved: RendererPostProcessing = {
    enabled: value.enabled ?? DEFAULT_POST_PROCESSING.enabled,
    ssao: {
      enabled: ssao.enabled ?? DEFAULT_POST_PROCESSING.ssao.enabled,
      mode: ssao.mode ?? DEFAULT_POST_PROCESSING.ssao.mode,
      radius: clampFinite(ssao.radius, DEFAULT_POST_PROCESSING.ssao.radius, 0.05, 8),
      intensity: clampFinite(ssao.intensity, DEFAULT_POST_PROCESSING.ssao.intensity, 0, 3),
      bias: clampFinite(ssao.bias, DEFAULT_POST_PROCESSING.ssao.bias, 0, 0.25),
      samples: Math.max(4, Math.min(32, Math.floor(finiteAtLeast(ssao.samples, DEFAULT_POST_PROCESSING.ssao.samples, 4)))),
      halfResolution: ssao.halfResolution ?? DEFAULT_POST_PROCESSING.ssao.halfResolution,
      denoise: ssao.denoise ?? DEFAULT_POST_PROCESSING.ssao.denoise,
      denoiseRadius: Math.max(1, Math.min(4, Math.floor(finiteAtLeast(ssao.denoiseRadius, DEFAULT_POST_PROCESSING.ssao.denoiseRadius, 1)))),
      directions: Math.max(2, Math.min(8, Math.floor(finiteAtLeast(ssao.directions, DEFAULT_POST_PROCESSING.ssao.directions, 2)))),
    },
    bloom: {
      enabled: bloom.enabled ?? DEFAULT_POST_PROCESSING.bloom.enabled,
      strength: clampFinite(bloom.strength, DEFAULT_POST_PROCESSING.bloom.strength, 0, 3),
      threshold: clampFinite(bloom.threshold, DEFAULT_POST_PROCESSING.bloom.threshold, 0, 16),
      radius: clampFinite(bloom.radius, DEFAULT_POST_PROCESSING.bloom.radius, 0, 2),
      levels: Math.max(1, Math.min(8, Math.floor(finiteAtLeast(bloom.levels, DEFAULT_POST_PROCESSING.bloom.levels, 1)))),
      scatter: clampFinite(bloom.scatter, DEFAULT_POST_PROCESSING.bloom.scatter, 0, 1),
      clamp: clampFinite(bloom.clamp, DEFAULT_POST_PROCESSING.bloom.clamp, 1, 64),
    },
    outlines: {
      enabled: outlines.enabled ?? DEFAULT_POST_PROCESSING.outlines.enabled,
      mode: outlines.mode ?? DEFAULT_POST_PROCESSING.outlines.mode,
      color: colorTriplet(outlines.color, DEFAULT_POST_PROCESSING.outlines.color),
      thickness: clampFinite(outlines.thickness, DEFAULT_POST_PROCESSING.outlines.thickness, 0.25, 8),
      depthThreshold: clampFinite(outlines.depthThreshold, DEFAULT_POST_PROCESSING.outlines.depthThreshold, 0.0001, 0.2),
      normalThreshold: clampFinite(outlines.normalThreshold, DEFAULT_POST_PROCESSING.outlines.normalThreshold, 0.01, 1),
      charactersOnly: outlines.charactersOnly ?? DEFAULT_POST_PROCESSING.outlines.charactersOnly,
    },
  }
  resolved.enabled = value.enabled ?? (resolved.ssao.enabled || resolved.bloom.enabled || resolved.outlines.enabled)
  return resolved
}

export function resolveOptimization(value: Partial<RendererOptimizationOptions> = {}): RendererOptimizationOptions {
  return {
    frustumCulling: value.frustumCulling ?? DEFAULT_OPTIMIZATION.frustumCulling,
    cachedBounds: value.cachedBounds ?? DEFAULT_OPTIMIZATION.cachedBounds,
    pipelineSorting: value.pipelineSorting ?? DEFAULT_OPTIMIZATION.pipelineSorting,
    shadowCasterCulling: value.shadowCasterCulling ?? DEFAULT_OPTIMIZATION.shadowCasterCulling,
    lodHysteresis: clampFinite(value.lodHysteresis, DEFAULT_OPTIMIZATION.lodHysteresis, 0, 0.5),
    hizOcclusion: value.hizOcclusion ?? DEFAULT_OPTIMIZATION.hizOcclusion,
    hizResolution: Math.max(16, Math.min(256, nearestPowerOfTwo(finiteAtLeast(value.hizResolution, DEFAULT_OPTIMIZATION.hizResolution, 16)))),
    occlusionHistoryFrames: Math.max(1, Math.min(8, Math.floor(finiteAtLeast(value.occlusionHistoryFrames, DEFAULT_OPTIMIZATION.occlusionHistoryFrames, 1)))),
    occlusionMinimumPixels: Math.max(1, Math.min(32, Math.floor(finiteAtLeast(value.occlusionMinimumPixels, DEFAULT_OPTIMIZATION.occlusionMinimumPixels, 1)))),
    clusteredLighting: value.clusteredLighting ?? DEFAULT_OPTIMIZATION.clusteredLighting,
    clusterDimensions: clusterDimensions(value.clusterDimensions, DEFAULT_OPTIMIZATION.clusterDimensions),
    maxLightsPerCluster: Math.max(1, Math.min(64, Math.floor(finiteAtLeast(value.maxLightsPerCluster, DEFAULT_OPTIMIZATION.maxLightsPerCluster, 1)))),
    maxClusteredLights: Math.max(1, Math.min(4096, Math.floor(finiteAtLeast(value.maxClusteredLights, DEFAULT_OPTIMIZATION.maxClusteredLights, 1)))),
    staticBatching: value.staticBatching ?? DEFAULT_OPTIMIZATION.staticBatching,
    staticBatchMinInstances: Math.max(2, Math.min(256, Math.floor(finiteAtLeast(value.staticBatchMinInstances, DEFAULT_OPTIMIZATION.staticBatchMinInstances, 2)))),
    textureMemoryBudgetMB: clampFinite(value.textureMemoryBudgetMB, DEFAULT_OPTIMIZATION.textureMemoryBudgetMB, 0, 8192),
    textureEvictionFrames: Math.max(1, Math.min(3600, Math.floor(finiteAtLeast(value.textureEvictionFrames, DEFAULT_OPTIMIZATION.textureEvictionFrames, 1)))),
    geometryMemoryBudgetMB: clampFinite(value.geometryMemoryBudgetMB, DEFAULT_OPTIMIZATION.geometryMemoryBudgetMB, 0, 16384),
    geometryEvictionFrames: Math.max(1, Math.min(7200, Math.floor(finiteAtLeast(value.geometryEvictionFrames, DEFAULT_OPTIMIZATION.geometryEvictionFrames, 1)))),
    regionStreaming: value.regionStreaming ?? DEFAULT_OPTIMIZATION.regionStreaming,
    streamingLoadDistance: finiteAtLeast(value.streamingLoadDistance, DEFAULT_OPTIMIZATION.streamingLoadDistance, 0),
    streamingUnloadDistance: Math.max(finiteAtLeast(value.streamingLoadDistance, DEFAULT_OPTIMIZATION.streamingLoadDistance, 0), finiteAtLeast(value.streamingUnloadDistance, DEFAULT_OPTIMIZATION.streamingUnloadDistance, 0)),
    streamingConcurrency: Math.max(1, Math.min(32, Math.floor(finiteAtLeast(value.streamingConcurrency, DEFAULT_OPTIMIZATION.streamingConcurrency, 1)))),
    worldOriginRebasing: value.worldOriginRebasing ?? DEFAULT_OPTIMIZATION.worldOriginRebasing,
    worldOriginThreshold: finiteAtLeast(value.worldOriginThreshold, DEFAULT_OPTIMIZATION.worldOriginThreshold, 1),
    worldOriginGridSize: finiteAtLeast(value.worldOriginGridSize, DEFAULT_OPTIMIZATION.worldOriginGridSize, 1),
  }
}

/** Practical split scheme used by cascaded directional shadows. */
export function computeShadowCascadeSplits(near: number, far: number, cascades: number, lambda = 0.65): readonly ShadowCascadeSplit[] {
  const safeNear = Math.max(0.001, near)
  const safeFar = Math.max(safeNear + 0.001, far)
  const count = Math.max(1, Math.min(4, Math.floor(cascades)))
  const weight = Math.max(0, Math.min(1, lambda))
  const result: ShadowCascadeSplit[] = []
  let previous = safeNear
  for (let index = 1; index <= count; index += 1) {
    const ratio = index / count
    const logarithmic = safeNear * Math.pow(safeFar / safeNear, ratio)
    const uniform = safeNear + (safeFar - safeNear) * ratio
    const split = uniform * (1 - weight) + logarithmic * weight
    result.push({ index: index - 1, near: previous, far: index === count ? safeFar : split })
    previous = split
  }
  return result
}

export function transformOutputColor(color: readonly [number, number, number], configuration: Partial<RendererColorManagement> = {}): [number, number, number] {
  const resolved = resolveColorManagement(configuration)
  const exposed: [number, number, number] = [Math.max(0, color[0] * resolved.exposure), Math.max(0, color[1] * resolved.exposure), Math.max(0, color[2] * resolved.exposure)]
  const mapped = exposed.map(value => toneMap(value, resolved.toneMapping)) as [number, number, number]
  return resolved.outputColorSpace === 'srgb' ? mapped.map(linearToSrgb) as [number, number, number] : mapped
}

export function toneMap(value: number, mode: ToneMappingMode): number {
  const x = Math.max(0, value)
  if (mode === 'none') return Math.min(1, x)
  if (mode === 'reinhard') return x / (1 + x)
  if (mode === 'neutral') return pbrNeutralToneMapScalar(x)
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
  return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)))
}

/** Scalar companion used by tests and single-channel authoring tools. GPU renderers use the RGB form. */
export function pbrNeutralToneMapScalar(value: number): number {
  let x = Math.max(0, value)
  const startCompression = 0.76
  if (x < 0.08) x = Math.max(0, x - 6.25 * x * x)
  else x = Math.max(0, x - 0.04)
  if (x < startCompression) return Math.min(1, x)
  const d = 1 - startCompression
  return Math.min(1, 1 - d * d / (x + d - startCompression))
}
export function srgbToLinear(value: number): number { const x = Math.max(0, Math.min(1, value)); return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
export function linearToSrgb(value: number): number { const x = Math.max(0, Math.min(1, value)); return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055 }
function finiteAtLeast(value: number | undefined, fallback: number, minimum: number): number { return Number.isFinite(value) ? Math.max(minimum, value as number) : fallback }
function clampFinite(value: number | undefined, fallback: number, minimum: number, maximum: number): number { return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value as number)) : fallback }
function nearestPowerOfTwo(value: number): number { return 2 ** Math.round(Math.log2(Math.max(1, value))) }
function colorTriplet(value: readonly [number, number, number] | undefined, fallback: readonly [number, number, number]): readonly [number, number, number] { if (!value) return [...fallback] as const; return [Math.max(0, value[0]), Math.max(0, value[1]), Math.max(0, value[2])] as const }
function clusterDimensions(value: readonly [number, number, number] | undefined, fallback: readonly [number, number, number]): readonly [number, number, number] {
  if (!value) return [...fallback] as const
  return [
    Math.max(1, Math.min(64, Math.floor(value[0]))),
    Math.max(1, Math.min(64, Math.floor(value[1]))),
    Math.max(1, Math.min(64, Math.floor(value[2]))),
  ] as const
}
