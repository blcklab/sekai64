import { Color, Vector3 } from '@sekai64-internal/math';
import { Node } from '@sekai64-internal/scene';
export class Light extends Node {
    color;
    intensity;
    constructor(options = {}) {
        super(options);
        this.color = Color.from(options.color ?? '#ffffff');
        this.intensity = Math.max(0, options.intensity ?? 1);
    }
}
export class AmbientLight extends Light {
    lightType = 'ambient';
    constructor(options = {}) { super(options); }
}
export class DirectionalLight extends Light {
    lightType = 'directional';
    direction = new Vector3(0, -1, 0);
    castShadow = false;
    constructor(options = {}) {
        super(options);
        if (options.direction)
            this.direction.fromArray(options.direction).normalize();
    }
}
export class PointLight extends Light {
    lightType = 'point';
    range;
    decay;
    castShadow = false;
    constructor(options = {}) {
        super(options);
        this.range = Math.max(0.0001, options.range ?? 10);
        this.decay = Math.max(0.0001, options.decay ?? 2);
    }
}
export class SpotLight extends PointLight {
    lightType = 'spot';
    direction = new Vector3(0, -1, 0);
    innerCone;
    outerCone;
    constructor(options = {}) {
        super(options);
        if (options.direction)
            this.direction.fromArray(options.direction).normalize();
        this.innerCone = clamp(options.innerCone ?? Math.PI / 8, 0, Math.PI / 2);
        this.outerCone = clamp(options.outerCone ?? Math.PI / 4, this.innerCone, Math.PI / 2);
    }
}
export class EnvironmentLight extends Light {
    lightType = 'environment';
    groundColor;
    source;
    specularIntensity;
    constructor(options = {}) {
        super(options);
        this.source = options.source;
        this.groundColor = Color.from(options.groundColor ?? '#101318');
        this.specularIntensity = Math.max(0, options.specularIntensity ?? 0.35);
    }
}
/** Collects deterministic scene lighting and selects the nearest local lights to the supplied reference position. */
export function collectSceneLights(scene, maxPointLights = 8, referencePosition, maxSpotLights = 4) {
    let ambientR = 0, ambientG = 0, ambientB = 0;
    let directionR = 0, directionG = 0, directionB = 0;
    const direction = new Vector3();
    const pointCandidates = [];
    const spotCandidates = [];
    let directionalCount = 0, pointCount = 0, spotCount = 0, order = 0;
    let directionalSource;
    let environmentSkyR = 0, environmentSkyG = 0, environmentSkyB = 0;
    let environmentGroundR = 0, environmentGroundG = 0, environmentGroundB = 0;
    let environmentSpecular = 0;
    scene.traverse(node => {
        if (!(node instanceof Light) || !node.worldVisible || node.intensity <= 0)
            return;
        if (node instanceof AmbientLight) {
            ambientR += srgbChannelToLinear(node.color.r) * node.intensity;
            ambientG += srgbChannelToLinear(node.color.g) * node.intensity;
            ambientB += srgbChannelToLinear(node.color.b) * node.intensity;
        }
        else if (node instanceof EnvironmentLight) {
            environmentSkyR += srgbChannelToLinear(node.color.r) * node.intensity;
            environmentSkyG += srgbChannelToLinear(node.color.g) * node.intensity;
            environmentSkyB += srgbChannelToLinear(node.color.b) * node.intensity;
            environmentGroundR += srgbChannelToLinear(node.groundColor.r) * node.intensity;
            environmentGroundG += srgbChannelToLinear(node.groundColor.g) * node.intensity;
            environmentGroundB += srgbChannelToLinear(node.groundColor.b) * node.intensity;
            environmentSpecular += node.specularIntensity * node.intensity;
        }
        else if (node instanceof DirectionalLight && directionalCount === 0) {
            directionR = srgbChannelToLinear(node.color.r) * node.intensity;
            directionG = srgbChannelToLinear(node.color.g) * node.intensity;
            directionB = srgbChannelToLinear(node.color.b) * node.intensity;
            direction.copy(node.direction).transformDirection(node.worldMatrix);
            directionalSource = node;
            directionalCount += 1;
        }
        else if (node instanceof SpotLight) {
            spotCount += 1;
            const position = new Vector3().setFromMatrixPosition(node.worldMatrix);
            const worldDirection = node.direction.clone().transformDirection(node.worldMatrix);
            spotCandidates.push({ light: node, position, direction: worldDirection, order: order++, distance: referencePosition ? position.distanceToSquared(referencePosition) : order });
        }
        else if (node instanceof PointLight) {
            pointCount += 1;
            const position = new Vector3().setFromMatrixPosition(node.worldMatrix);
            pointCandidates.push({ light: node, position, order: order++, distance: referencePosition ? position.distanceToSquared(referencePosition) : order });
        }
    });
    pointCandidates.sort((a, b) => a.distance - b.distance || a.order - b.order);
    spotCandidates.sort((a, b) => a.distance - b.distance || a.order - b.order);
    const pointLights = pointCandidates.slice(0, Math.max(0, Math.floor(maxPointLights))).map(({ light, position }) => ({
        positionRange: [position.x, position.y, position.z, light.range],
        colorDecay: [
            srgbChannelToLinear(light.color.r) * light.intensity,
            srgbChannelToLinear(light.color.g) * light.intensity,
            srgbChannelToLinear(light.color.b) * light.intensity,
            light.decay,
        ],
        source: light,
    }));
    const spotLights = spotCandidates.slice(0, Math.max(0, Math.floor(maxSpotLights))).map(({ light, position, direction: worldDirection }) => ({
        positionRange: [position.x, position.y, position.z, light.range],
        directionOuter: [worldDirection.x, worldDirection.y, worldDirection.z, Math.cos(light.outerCone)],
        colorInnerDecay: [
            srgbChannelToLinear(light.color.r) * light.intensity,
            srgbChannelToLinear(light.color.g) * light.intensity,
            srgbChannelToLinear(light.color.b) * light.intensity,
            Math.cos(light.innerCone),
        ],
        source: light,
    }));
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
    };
}
function srgbChannelToLinear(value) {
    const normalized = Math.max(0, value);
    return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
}
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
//# sourceMappingURL=Light.js.map