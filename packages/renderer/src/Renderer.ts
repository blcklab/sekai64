import type { Camera } from '@sekai64-internal/cameras'
import type { ColorInput } from '@sekai64-internal/math'
import type { Scene } from '@sekai64-internal/scene'
import type { RendererProceduralCloudInput } from './ProceduralClouds.js'
import type { RendererAtmosphere, RendererColorGrading, RendererColorManagement, RendererEnvironmentLighting, RendererImageQuality, RendererOptimizationOptions, RendererPostProcessing, RendererShadowOptions } from './VisualPipeline.js'

export type RendererBackend = 'webgpu' | 'webgl2'
export type PowerPreference = 'low-power' | 'high-performance'
export type RenderSurface = HTMLCanvasElement | OffscreenCanvas

export interface RendererDiagnostic {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  details?: Readonly<Record<string, unknown>>
}
export type RendererDiagnosticSink = (diagnostic: RendererDiagnostic) => void

export type RendererEnvironmentFormat = 'rgba8-srgb' | 'rgba16f-linear'
export type RendererEnvironmentPixels = Uint8Array | Uint8ClampedArray | Float32Array

export interface RendererEnvironmentLevel {
  width: number
  height: number
  pixels: RendererEnvironmentPixels
}

export interface RendererEnvironmentMap extends RendererEnvironmentLevel {
  /** GPU storage/transfer format. Legacy maps default to `rgba8-srgb`. */
  format?: RendererEnvironmentFormat
  /** Optional GGX-prefiltered specular roughness levels. Level zero remains `pixels`. */
  mipLevels?: readonly Readonly<RendererEnvironmentLevel>[]
  /** Optional cosine-convolved diffuse irradiance map, kept in the same linear domain. */
  diffuse?: Readonly<RendererEnvironmentLevel>
  /** Optional split-sum DFG/BRDF integration LUT. RG store scale/bias; BA are reserved. */
  brdfLut?: Readonly<RendererEnvironmentLevel>
  intensity?: number
  rotation?: number
  /** Draw this environment as a camera-rotation-stable background. Defaults to false for compatibility. */
  background?: boolean
  /** Independent visible-background intensity; does not change IBL/specular intensity. */
  backgroundIntensity?: number
  label?: string
}

export interface RendererOptions {
  canvas: RenderSurface
  antialias?: boolean
  alpha?: boolean
  powerPreference?: PowerPreference
  /** Maximum point lights evaluated per frame. Defaults to 8. */
  maxPointLights?: number
  maxSpotLights?: number
  diagnostics?: RendererDiagnosticSink
  colorManagement?: Partial<RendererColorManagement>
  environmentLighting?: Partial<RendererEnvironmentLighting>
  shadows?: Partial<RendererShadowOptions>
  imageQuality?: Partial<RendererImageQuality>
  atmosphere?: Partial<RendererAtmosphere>
  colorGrading?: Partial<RendererColorGrading>
  postProcessing?: Partial<RendererPostProcessing>
  optimization?: Partial<RendererOptimizationOptions>
}

export interface RendererFeatureCapabilities {
  text: boolean
  images: boolean
  models: boolean
  ambientLights: boolean
  directionalLights: boolean
  pointLights: boolean
  spotLights: boolean
  picking: boolean
  trianglePicking: boolean
  instancedPicking: boolean
  shadows: boolean
  wireframe: boolean
  baseColorTextures: boolean
  normalTextures: boolean
  metallicRoughnessTextures: boolean
  emissiveTextures: boolean
  occlusionTextures: boolean
  lightMapTextures: boolean
  pbrSpecular: boolean
  clearcoat: boolean
  sheen: boolean
  waterMaterials: boolean
  vertexColors: boolean
  alphaMask: boolean
  alphaBlend: boolean
  doubleSidedMaterials: boolean
  xr: boolean
  skinning: boolean
  morphTargets: boolean
  environmentMaps: boolean
  hdrEnvironment: boolean
  imageBasedLighting: boolean
  automaticRecovery: boolean
  gpuPostProcessing: boolean
  ssao: boolean
  bloom: boolean
  outlines: boolean
  cascadedShadows: boolean
  mipmapGeneration: boolean
  gtao: boolean
  bloomPyramid: boolean
  invertedHullOutlines: boolean
  fxaa: boolean
  faceShadowMaps: boolean
  transparentHair: boolean
  hizOcclusion: boolean
  clusteredLighting: boolean
  staticBatching: boolean
  textureStreaming: boolean
  colorLuts: boolean
  prefilteredEnvironmentMaps: boolean
  externalTextureDecoders: boolean
}

export type RendererShaderVariant = 'static' | 'skinned' | 'morph' | 'skinned-morph'

export interface RendererAdvancedCapabilities {
  maxJoints: number
  maxMorphTargets: number
  shaderVariants: readonly RendererShaderVariant[]
}


export interface RendererCapabilities {
  backend: RendererBackend
  maxTextureSize: number
  maxPointLights: number
  maxSpotLights: number
  computeShaders: boolean
  timestampQueries: boolean
  instancing: boolean
  offscreenCanvas: boolean
  features: RendererFeatureCapabilities
  advanced: RendererAdvancedCapabilities
}

export interface RendererStats {
  drawCalls: number
  instancedDrawCalls: number
  instancesRendered: number
  triangles: number
  visibleObjects: number
  culledObjects: number
  frustumCulledObjects: number
  occlusionCulledObjects: number
  occlusionCandidates: number
  pipelineChanges: number
  pipelineCacheHits: number
  pipelineCacheMisses: number
  geometryCacheHits: number
  geometryCacheMisses: number
  textureCacheHits: number
  textureCacheMisses: number
  bindGroupCacheHits: number
  bindGroupCacheMisses: number
  shaderCompilations: number
  materialChanges: number
  uniformUpdates: number
  bindGroupChanges: number
  geometryMemory: number
  textureMemory: number
  geometryUploads: number
  geometryEvictions: number
  textureUploads: number
  textureEvictions: number
  shadowDrawCalls: number
  shadowedLights: number
  postProcessPasses: number
  cpuFrameMs: number
  gpuFrameMs: number | null
  fps: number
  renderScale: number
  renderQueueBuildMs: number
  renderQueueSortMs: number
  lightGridBuildMs: number
  shadowPassMs: number
  mainPassMs: number
  postProcessMs: number
  residencyMs: number
  transformNodesVisited: number
  transformNodesUpdated: number
  transformSubtreesSkipped: number
  boundsCacheHits: number
  boundsCacheMisses: number
  renderItemAllocations: number
  renderItemPoolSize: number
  clusterCount: number
  clusteredLightReferences: number
  clusterOverflows: number
  maxClusterLights: number
  visibleLights: number
  rejectedLights: number
  staticBatches: number
  lodSwitches: number
  lodLevelCounts: number[]
  gpuResourceCreations: number
  gpuResourceCreationsThisFrame: number
}


export interface RendererRecoveryOptions {
  reason?: unknown
  onProgress?: (progress: number, message?: string) => void
}

export interface RecoverableRenderer extends Renderer {
  recover(options?: RendererRecoveryOptions): Promise<void>
}

export interface Renderer {
  readonly backend: RendererBackend
  readonly capabilities: RendererCapabilities
  readonly stats: RendererStats
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly disposed: boolean
  readonly colorManagement: Readonly<RendererColorManagement>
  readonly environmentLighting: Readonly<RendererEnvironmentLighting>
  readonly environmentMap: Readonly<RendererEnvironmentMap> | undefined
  readonly shadowOptions: Readonly<RendererShadowOptions>
  readonly imageQuality: Readonly<RendererImageQuality>
  readonly atmosphere: Readonly<RendererAtmosphere>
  readonly colorGrading: Readonly<RendererColorGrading>
  readonly postProcessing: Readonly<RendererPostProcessing>
  readonly optimization: Readonly<RendererOptimizationOptions>
  initialize(options: RendererOptions): Promise<void>
  resize(width: number, height: number, pixelRatio: number): void
  setClearColor(color: ColorInput): void
  setColorManagement(options: Partial<RendererColorManagement>): void
  setEnvironmentLighting(options: Partial<RendererEnvironmentLighting>): void
  setEnvironmentMap(environment: RendererEnvironmentMap | undefined): void
  /** Optional dynamic procedural-cloud overlay for environment backgrounds. */
  setProceduralClouds?(clouds: RendererProceduralCloudInput | undefined): void
  setShadowOptions(options: Partial<RendererShadowOptions>): void
  setImageQuality(options: Partial<RendererImageQuality>): void
  setAtmosphere(options: Partial<RendererAtmosphere>): void
  setColorGrading(options: Partial<RendererColorGrading>): void
  setPostProcessing(options: Partial<RendererPostProcessing>): void
  setOptimization(options: Partial<RendererOptimizationOptions>): void
  render(scene: Scene, camera: Camera): void
  dispose(): void
}

export function createRendererStats(): RendererStats {
  return {
    drawCalls: 0, instancedDrawCalls: 0, instancesRendered: 0, triangles: 0,
    visibleObjects: 0, culledObjects: 0, frustumCulledObjects: 0, occlusionCulledObjects: 0, occlusionCandidates: 0,
    pipelineChanges: 0, pipelineCacheHits: 0, pipelineCacheMisses: 0,
    geometryCacheHits: 0, geometryCacheMisses: 0, textureCacheHits: 0, textureCacheMisses: 0, bindGroupCacheHits: 0, bindGroupCacheMisses: 0, shaderCompilations: 0,
    materialChanges: 0, uniformUpdates: 0, bindGroupChanges: 0,
    geometryMemory: 0, textureMemory: 0, geometryUploads: 0, geometryEvictions: 0, textureUploads: 0, textureEvictions: 0,
    shadowDrawCalls: 0, shadowedLights: 0, postProcessPasses: 0,
    cpuFrameMs: 0, gpuFrameMs: null, fps: 0, renderScale: 1,
    renderQueueBuildMs: 0, renderQueueSortMs: 0, lightGridBuildMs: 0, shadowPassMs: 0, mainPassMs: 0, postProcessMs: 0, residencyMs: 0,
    transformNodesVisited: 0, transformNodesUpdated: 0, transformSubtreesSkipped: 0,
    boundsCacheHits: 0, boundsCacheMisses: 0, renderItemAllocations: 0, renderItemPoolSize: 0,
    clusterCount: 0, clusteredLightReferences: 0, clusterOverflows: 0, maxClusterLights: 0, visibleLights: 0, rejectedLights: 0,
    staticBatches: 0, lodSwitches: 0, lodLevelCounts: [], gpuResourceCreations: 0, gpuResourceCreationsThisFrame: 0,
  }
}

export function createRendererFeatures(overrides: Partial<RendererFeatureCapabilities> = {}): RendererFeatureCapabilities {
  return {
    text: true,
    images: true,
    models: true,
    ambientLights: true,
    directionalLights: true,
    pointLights: true,
    spotLights: false,
    picking: true,
    trianglePicking: true,
    instancedPicking: true,
    shadows: false,
    wireframe: false,
    baseColorTextures: true,
    normalTextures: true,
    metallicRoughnessTextures: true,
    emissiveTextures: true,
    occlusionTextures: true,
    lightMapTextures: true,
    pbrSpecular: true,
    clearcoat: true,
    sheen: true,
    waterMaterials: true,
    vertexColors: true,
    alphaMask: true,
    alphaBlend: true,
    doubleSidedMaterials: true,
    xr: false,
    skinning: false,
    morphTargets: false,
    environmentMaps: false,
    hdrEnvironment: false,
    imageBasedLighting: false,
    automaticRecovery: false,
    gpuPostProcessing: false,
    ssao: false,
    bloom: false,
    outlines: false,
    cascadedShadows: false,
    mipmapGeneration: false,
    gtao: false,
    bloomPyramid: false,
    invertedHullOutlines: false,
    fxaa: false,
    faceShadowMaps: false,
    transparentHair: false,
    hizOcclusion: false,
    clusteredLighting: false,
    staticBatching: false,
    textureStreaming: false,
    colorLuts: false,
    prefilteredEnvironmentMaps: false,
    externalTextureDecoders: true,
    ...overrides
  }
}

export function createRendererAdvancedCapabilities(overrides: Partial<RendererAdvancedCapabilities> = {}): RendererAdvancedCapabilities {
  return { maxJoints: 0, maxMorphTargets: 0, shaderVariants: Object.freeze(['static'] as const), ...overrides }
}
