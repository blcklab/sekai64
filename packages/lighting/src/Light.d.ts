import { Color, Vector3, type ColorInput } from '@sekai64-internal/math';
import { Node, type NodeOptions, type Scene } from '@sekai64-internal/scene';
export type LightType = 'ambient' | 'directional' | 'point' | 'spot' | 'environment';
export interface LightOptions extends NodeOptions {
    color?: ColorInput;
    intensity?: number;
}
export declare abstract class Light extends Node {
    abstract readonly lightType: LightType;
    readonly color: Color;
    intensity: number;
    protected constructor(options?: LightOptions);
}
export declare class AmbientLight extends Light {
    readonly lightType: "ambient";
    constructor(options?: LightOptions);
}
export interface DirectionalLightOptions extends LightOptions {
    direction?: readonly [number, number, number];
}
export declare class DirectionalLight extends Light {
    readonly lightType: "directional";
    readonly direction: Vector3;
    castShadow: boolean;
    constructor(options?: DirectionalLightOptions);
}
export interface PointLightOptions extends LightOptions {
    range?: number;
    decay?: number;
}
export declare class PointLight extends Light {
    readonly lightType: LightType;
    range: number;
    decay: number;
    castShadow: boolean;
    constructor(options?: PointLightOptions);
}
export interface SpotLightOptions extends PointLightOptions {
    direction?: readonly [number, number, number];
    innerCone?: number;
    outerCone?: number;
}
export declare class SpotLight extends PointLight {
    readonly lightType: LightType;
    readonly direction: Vector3;
    innerCone: number;
    outerCone: number;
    constructor(options?: SpotLightOptions);
}
export interface EnvironmentLightOptions extends LightOptions {
    source?: string;
    groundColor?: ColorInput;
    specularIntensity?: number;
}
export declare class EnvironmentLight extends Light {
    readonly lightType: "environment";
    readonly groundColor: Color;
    source?: string;
    specularIntensity: number;
    constructor(options?: EnvironmentLightOptions);
}
export interface CompiledPointLight {
    positionRange: readonly [number, number, number, number];
    colorDecay: readonly [number, number, number, number];
    source: PointLight;
}
export interface CompiledSpotLight {
    positionRange: readonly [number, number, number, number];
    directionOuter: readonly [number, number, number, number];
    colorInnerDecay: readonly [number, number, number, number];
    source: SpotLight;
}
export interface SceneLightSummary {
    ambient: readonly [number, number, number];
    directionalColor: readonly [number, number, number];
    directionalDirection: readonly [number, number, number];
    directionalCount: number;
    directionalSource?: DirectionalLight;
    environmentSky: readonly [number, number, number];
    environmentGround: readonly [number, number, number];
    environmentSpecular: number;
    pointCount: number;
    selectedPointCount: number;
    spotCount: number;
    selectedSpotCount: number;
    pointLights: readonly CompiledPointLight[];
    spotLights: readonly CompiledSpotLight[];
}
/** Collects deterministic scene lighting and selects the nearest local lights to the supplied reference position. */
export declare function collectSceneLights(scene: Scene, maxPointLights?: number, referencePosition?: Vector3, maxSpotLights?: number): SceneLightSummary;
