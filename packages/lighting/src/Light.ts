import { Color, Vector3, type ColorInput } from '@sekai64-internal/math'
import { Node, type NodeOptions, type Scene } from '@sekai64-internal/scene'

export type LightType = 'ambient' | 'directional' | 'point' | 'spot' | 'environment'

export interface LightOptions extends NodeOptions {
  color?: ColorInput
  intensity?: number
}

export abstract class Light extends Node {
  abstract readonly lightType: LightType
  readonly color: Color
  intensity: number

  protected constructor(options: LightOptions = {}) {
    super(options)
    this.color = Color.from(options.color ?? '#ffffff')
    this.intensity = Math.max(0, options.intensity ?? 1)
  }
}

export class AmbientLight extends Light {
  readonly lightType = 'ambient' as const
  constructor(options: LightOptions = {}) { super(options) }
}

export interface DirectionalLightOptions extends LightOptions { direction?: readonly [number, number, number] }
export class DirectionalLight extends Light {
  readonly lightType = 'directional' as const
  readonly direction = new Vector3(0, -1, 0)
  castShadow = false
  constructor(options: DirectionalLightOptions = {}) {
    super(options)
    if (options.direction) this.direction.fromArray(options.direction).normalize()
  }
}

export interface PointLightOptions extends LightOptions { range?: number; decay?: number }
export class PointLight extends Light {
  readonly lightType: LightType = 'point'
  range: number
  decay: number
  castShadow = false
  constructor(options: PointLightOptions = {}) {
    super(options)
    this.range = Math.max(0.0001, options.range ?? 10)
    this.decay = Math.max(0.0001, options.decay ?? 2)
  }
}

export interface SpotLightOptions extends PointLightOptions { direction?: readonly [number, number, number]; innerCone?: number; outerCone?: number }
export class SpotLight extends PointLight {
  override readonly lightType: LightType = 'spot'
  readonly direction = new Vector3(0, -1, 0)
  innerCone: number
  outerCone: number
  constructor(options: SpotLightOptions = {}) {
    super(options)
    if (options.direction) this.direction.fromArray(options.direction).normalize()
    this.innerCone = clamp(options.innerCone ?? Math.PI / 8, 0, Math.PI / 2)
    this.outerCone = clamp(options.outerCone ?? Math.PI / 4, this.innerCone, Math.PI / 2)
  }
}

export interface EnvironmentLightOptions extends LightOptions { source?: string; groundColor?: ColorInput; specularIntensity?: number }
export class EnvironmentLight extends Light {
  readonly lightType = 'environment' as const
  readonly groundColor: Color
  source?: string
  specularIntensity: number
  constructor(options: EnvironmentLightOptions = {}) {
    super(options)
    this.source = options.source
    this.groundColor = Color.from(options.groundColor ?? '#101318')
    this.specularIntensity = Math.max(0, options.specularIntensity ?? 0.35)
  }
}

export interface CompiledPointLight {
  positionRange: readonly [number, number, number, number]
  colorDecay: readonly [number, number, number, number]
  source: PointLight
}
export interface CompiledSpotLight {
  positionRange: readonly [number, number, number, number]
  directionOuter: readonly [number, number, number, number]
  colorInnerDecay: readonly [number, number, number, number]
  source: SpotLight
}

export interface SceneLightSummary {
  ambient: readonly [number, number, number]
  directionalColor: readonly [number, number, number]
  directionalDirection: readonly [number, number, number]
  directionalCount: number
  directionalSource?: DirectionalLight
  environmentSky: readonly [number, number, number]
  environmentGround: readonly [number, number, number]
  environmentSpecular: number
  pointCount: number
  selectedPointCount: number
  spotCount: number
  selectedSpotCount: number
  pointLights: readonly CompiledPointLight[]
  spotLights: readonly CompiledSpotLight[]
}

/** Collects deterministic scene lighting and selects the nearest local lights to the supplied reference position. */
export function collectSceneLights(scene: Scene, maxPointLights = 8, referencePosition?: Vector3, maxSpotLights = 4): SceneLightSummary {
  let ambientR = 0, ambientG = 0, ambientB = 0
  let directionR = 0, directionG = 0, directionB = 0
  const direction = new Vector3()
  const pointCandidates: Array<{ light: PointLight; position: Vector3; order: number; distance: number }> = []
  const spotCandidates: Array<{ light: SpotLight; position: Vector3; direction: Vector3; order: number; distance: number }> = []
  let directionalCount = 0, pointCount = 0, spotCount = 0, order = 0
  let directionalSource: DirectionalLight | undefined
  let environmentSkyR = 0, environmentSkyG = 0, environmentSkyB = 0
  let environmentGroundR = 0, environmentGroundG = 0, environmentGroundB = 0
  let environmentSpecular = 0
  scene.traverse(node => {
    if (!(node instanceof Light) || !node.worldVisible || node.intensity <= 0) return
    if (node instanceof AmbientLight) {
      ambientR += srgbChannelToLinear(node.color.r) * node.intensity
      ambientG += srgbChannelToLinear(node.color.g) * node.intensity
      ambientB += srgbChannelToLinear(node.color.b) * node.intensity
    } else if (node instanceof EnvironmentLight) {
      environmentSkyR += srgbChannelToLinear(node.color.r) * node.intensity
      environmentSkyG += srgbChannelToLinear(node.color.g) * node.intensity
      environmentSkyB += srgbChannelToLinear(node.color.b) * node.intensity
      environmentGroundR += srgbChannelToLinear(node.groundColor.r) * node.intensity
      environmentGroundG += srgbChannelToLinear(node.groundColor.g) * node.intensity
      environmentGroundB += srgbChannelToLinear(node.groundColor.b) * node.intensity
      environmentSpecular += node.specularIntensity * node.intensity
    } else if (node instanceof DirectionalLight && directionalCount === 0) {
      directionR = srgbChannelToLinear(node.color.r) * node.intensity
      directionG = srgbChannelToLinear(node.color.g) * node.intensity
      directionB = srgbChannelToLinear(node.color.b) * node.intensity
      direction.copy(node.direction).transformDirection(node.worldMatrix)
      directionalSource = node
      directionalCount += 1
    } else if (node instanceof SpotLight) {
      spotCount += 1
      const position = new Vector3().setFromMatrixPosition(node.worldMatrix)
      const worldDirection = node.direction.clone().transformDirection(node.worldMatrix)
      spotCandidates.push({ light: node, position, direction: worldDirection, order: order++, distance: referencePosition ? position.distanceToSquared(referencePosition) : order })
    } else if (node instanceof PointLight) {
      pointCount += 1
      const position = new Vector3().setFromMatrixPosition(node.worldMatrix)
      pointCandidates.push({ light: node, position, order: order++, distance: referencePosition ? position.distanceToSquared(referencePosition) : order })
    }
  })
  pointCandidates.sort((a, b) => a.distance - b.distance || a.order - b.order)
  spotCandidates.sort((a, b) => a.distance - b.distance || a.order - b.order)
  const pointLights = pointCandidates.slice(0, Math.max(0, Math.floor(maxPointLights))).map(({ light, position }): CompiledPointLight => ({
    positionRange: [position.x, position.y, position.z, light.range],
    colorDecay: [
      srgbChannelToLinear(light.color.r) * light.intensity,
      srgbChannelToLinear(light.color.g) * light.intensity,
      srgbChannelToLinear(light.color.b) * light.intensity,
      light.decay,
    ],
    source: light,
  }))
  const spotLights = spotCandidates.slice(0, Math.max(0, Math.floor(maxSpotLights))).map(({ light, position, direction: worldDirection }): CompiledSpotLight => ({
    positionRange: [position.x, position.y, position.z, light.range],
    directionOuter: [worldDirection.x, worldDirection.y, worldDirection.z, Math.cos(light.outerCone)],
    colorInnerDecay: [
      srgbChannelToLinear(light.color.r) * light.intensity,
      srgbChannelToLinear(light.color.g) * light.intensity,
      srgbChannelToLinear(light.color.b) * light.intensity,
      Math.cos(light.innerCone),
    ],
    source: light,
  }))
  return {
    ambient: [ambientR, ambientG, ambientB],
    directionalColor: [directionR, directionG, directionB],
    directionalDirection: [direction.x, direction.y, direction.z],
    directionalCount,
    directionalSource,
    environmentSky: [environmentSkyR, environmentSkyG, environmentSkyB],
    environmentGround: [environmentGroundR, environmentGroundG, environmentGroundB],
    environmentSpecular,
    pointCount,
    selectedPointCount: pointLights.length,
    spotCount,
    selectedSpotCount: spotLights.length,
    pointLights,
    spotLights,
  }
}

function srgbChannelToLinear(value: number): number {
  const normalized = Math.max(0, value)
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
