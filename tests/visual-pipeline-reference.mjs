import assert from 'node:assert/strict'
import { Box3, Vector3 } from '@blcklab/sekai64/math'
import { AmbientLight, PointLight, Scene, collectSceneLights } from '@blcklab/sekai64'
import { StandardMaterial, Texture } from '@blcklab/sekai64/materials'
import { BeveledBoxGeometry } from '@blcklab/sekai64/geometry/beveled-box'
import { createDirectionalShadowFrame, DEFAULT_ENVIRONMENT_LIGHTING, linearToSrgb, PRODUCT_VISUAL_PRESET, resolveColorManagement, resolveShadowOptions, srgbToLinear, transformOutputColor } from '@blcklab/sekai64/renderer'

assert.deepEqual(resolveColorManagement(), { toneMapping: 'aces', exposure: 1, outputColorSpace: 'srgb' })
assert.equal(DEFAULT_ENVIRONMENT_LIGHTING.specularIntensity, 1)
assert.equal(PRODUCT_VISUAL_PRESET.environmentLighting.specularIntensity, 1)
assert.equal(PRODUCT_VISUAL_PRESET.imageQuality.maxAnisotropy, 16)
assert.equal(PRODUCT_VISUAL_PRESET.shadows.mapSize, 2048)
const hdr = transformOutputColor([4, 1, 0.25])
assert.ok(hdr[0] > hdr[1] && hdr[1] > hdr[2])
assert.ok(hdr.every(value => value >= 0 && value <= 1))
for (const value of [0, 0.02, 0.18, 0.5, 1]) assert.ok(Math.abs(linearToSrgb(srgbToLinear(value)) - value) < 1e-6)
assert.equal(resolveShadowOptions({ mapSize: 1500 }).mapSize, 2048)
const lightingScene = new Scene()
const ambient = new AmbientLight({ color: '#808080', intensity: 0.25 })
const point = new PointLight({ color: '#808080', intensity: 4, range: 8 })
lightingScene.add(ambient, point)
lightingScene.updateWorldMatrix()
const lighting = collectSceneLights(lightingScene, 4, new Vector3())
const middleGrayLinear = srgbToLinear(128 / 255)
assert.ok(Math.abs(lighting.ambient[0] - middleGrayLinear * 0.25) < 1e-6)
assert.ok(Math.abs(lighting.pointLights[0].colorDecay[0] - middleGrayLinear * 4) < 1e-6)
assert.ok(lighting.pointLights[0].colorDecay[0] > 0.8)
const frame = createDirectionalShadowFrame(new Box3(new Vector3(-5, 0, -5), new Vector3(5, 4, 5)), [0.4, -1, 0.2])
assert.ok(frame && frame.matrix.elements.every(Number.isFinite))
const geometry = new BeveledBoxGeometry({ width: 4, height: 2, depth: 1, bevelRadius: 0.1, bevelSegments: 2 })
assert.ok(geometry.triangleCount > 12)
const metallic = new Texture({ source: new Uint8Array([255, 255, 255, 255]) })
const roughness = new Texture({ source: new Uint8Array([255, 255, 255, 255]) })
const material = new StandardMaterial({ metallicTexture: metallic, roughnessTexture: roughness, transmission: 2, ior: 9, thickness: -2 })
assert.equal(material.transmission, 1)
assert.equal(material.ior, 2.5)
assert.equal(material.thickness, 0)
material.dispose(); geometry.dispose()
console.log('Sekai64 visual pipeline CPU, material, shadow-frame, and beveled-geometry references passed.')
