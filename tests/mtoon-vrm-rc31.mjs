import assert from 'node:assert/strict'
import { AssetManager } from '../dist/assets/index.js'
import { GltfLoader, GLTF_LOADER_CAPABILITIES } from '../dist/gltf/index.js'
import { StandardMaterial } from '../dist/materials/index.js'
import { CHARACTER_VISUAL_PRESET } from '../dist/renderer/index.js'
import { Mesh } from '../dist/scene/index.js'

function makeMtoonGlb(legacy = false) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const bin = new Uint8Array(positions.buffer)
  const document = {
    asset: { version: '2.0' },
    extensionsUsed: legacy ? ['VRM'] : ['VRMC_materials_mtoon'],
    ...(legacy ? {
      extensions: {
        VRM: {
          materialProperties: [{
            name: 'Face Skin',
            shader: 'VRM/MToon',
            floatProperties: {
              _ShadeShift: -0.2,
              _ShadeToony: 0.78,
              _RimLightingMix: 0.6,
              _RimFresnelPower: 2.8,
              _RimLift: 0.04,
              _OutlineWidthMode: 1,
              _OutlineWidth: 0.004,
              _OutlineLightingMix: 0.3,
            },
            vectorProperties: {
              _ShadeColor: [0.3, 0.22, 0.18, 1],
              _RimColor: [0.08, 0.04, 0.03, 1],
              _OutlineColor: [0.05, 0.04, 0.04, 1],
            },
            textureProperties: {},
          }],
        },
      },
    } : {}),
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    materials: [{
      name: 'Face Skin',
      alphaMode: 'MASK',
      alphaCutoff: 0.45,
      pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.5, 1] },
      ...(!legacy ? {
        extensions: {
          VRMC_materials_mtoon: {
            shadeColorFactor: [0.4, 0.2, 0.15],
            shadingShiftFactor: -0.12,
            shadingToonyFactor: 0.85,
            giEqualizationFactor: 0.8,
            parametricRimColorFactor: [0.1, 0.05, 0.04],
            rimLightingMixFactor: 0.72,
            parametricRimFresnelPowerFactor: 3.2,
            parametricRimLiftFactor: 0.08,
            outlineWidthMode: 'worldCoordinates',
            outlineWidthFactor: 0.006,
            outlineColorFactor: [0.07, 0.05, 0.09],
            outlineLightingMixFactor: 0.2,
          },
        },
      } : {}),
    }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }

  const json = new TextEncoder().encode(JSON.stringify(document))
  const jsonLength = Math.ceil(json.length / 4) * 4
  const binLength = Math.ceil(bin.length / 4) * 4
  const total = 12 + 8 + jsonLength + 8 + binLength
  const bytes = new Uint8Array(total)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(json, 20)
  bytes.fill(0x20, 20 + json.length, 20 + jsonLength)
  const offset = 20 + jsonLength
  view.setUint32(offset, binLength, true)
  view.setUint32(offset + 4, 0x004e4942, true)
  bytes.set(bin, offset + 8)
  return bytes.buffer
}

function linearToSrgb(value) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}

assert.ok(GLTF_LOADER_CAPABILITIES.materialTextures.includes('mtoonShade'))
assert.ok(GLTF_LOADER_CAPABILITIES.materialTextures.includes('mtoonMatcap'))
assert.equal(GLTF_LOADER_CAPABILITIES.legacyVrmMtoon, true)
assert.equal(CHARACTER_VISUAL_PRESET.imageQuality.antialiasing, 'fxaa-high')
assert.ok(CHARACTER_VISUAL_PRESET.imageQuality.renderScale > 1)
assert.equal(CHARACTER_VISUAL_PRESET.postProcessing?.outlines.mode, 'inverted-hull')
assert.equal(CHARACTER_VISUAL_PRESET.postProcessing?.outlines.charactersOnly, true)

const fixture = makeMtoonGlb()
const assets = new AssetManager()
assets.addResolver({
  canResolve: url => url.href === 'https://test.local/avatar.vrm',
  async fetch() { return new Response(fixture, { status: 200 }) },
})
const loader = new GltfLoader(assets)
const asset = await loader.load('https://test.local/avatar.vrm', { draco: false, animatedFallback: 'static-pose' })
const mesh = asset.scene.findByTag('gltf-mesh')[0]
assert.ok(mesh instanceof Mesh)
assert.ok(mesh.material instanceof StandardMaterial)
assert.equal(mesh.material.shadingModel, 'mtoon')
assert.equal(mesh.material.characterRole, 'skin')
assert.equal(mesh.material.mtoonShadingToony, 0.85)
assert.equal(mesh.material.mtoonGiEqualization, 0.8)
assert.equal(mesh.material.mtoonRimLightingMix, 0.72)
assert.equal(mesh.material.mtoonOutlineWidthMode, 'worldCoordinates')
assert.equal(mesh.material.mtoonOutlineWidth, 0.006)
assert.ok(mesh.material.mtoonOcclusionMix < 0.5)

const expectedShade = [0.4, 0.2, 0.15].map(linearToSrgb)
const actualShade = [mesh.material.mtoonShadeColor.r, mesh.material.mtoonShadeColor.g, mesh.material.mtoonShadeColor.b]
for (let i = 0; i < 3; i++) assert.ok(Math.abs(actualShade[i] - expectedShade[i]) < 1e-9)

const legacyFixture = makeMtoonGlb(true)
const legacyAssets = new AssetManager()
legacyAssets.addResolver({
  canResolve: url => url.href === 'https://test.local/legacy-avatar.vrm',
  async fetch() { return new Response(legacyFixture, { status: 200 }) },
})
const legacyLoader = new GltfLoader(legacyAssets)
const legacyAsset = await legacyLoader.load('https://test.local/legacy-avatar.vrm', { draco: false, animatedFallback: 'static-pose' })
const legacyMesh = legacyAsset.scene.findByTag('gltf-mesh')[0]
assert.ok(legacyMesh instanceof Mesh)
assert.ok(legacyMesh.material instanceof StandardMaterial)
assert.equal(legacyMesh.material.shadingModel, 'mtoon')
assert.equal(legacyMesh.material.characterRole, 'skin')
assert.equal(legacyMesh.material.mtoonShadingShift, -0.2)
assert.equal(legacyMesh.material.mtoonShadingToony, 0.78)
assert.equal(legacyMesh.material.mtoonOutlineWidthMode, 'worldCoordinates')
assert.equal(legacyMesh.material.mtoonOutlineWidth, 0.004)
legacyAsset.dispose()
legacyLoader.dispose()
legacyAssets.dispose()

const hair = new StandardMaterial({ shadingModel: 'mtoon', character: { role: 'hair' }, alphaMode: 'blend' })
assert.equal(hair.characterRole, 'hair')
assert.ok(hair.characterHairSpecularStrength > 0)
assert.equal(hair.mtoonHairAlphaDither, true)
hair.dispose()

const eye = new StandardMaterial({ shadingModel: 'mtoon', character: { role: 'eye' } })
assert.equal(eye.characterRole, 'eye')
assert.ok(eye.characterEyeHighlightStrength > 0)
eye.dispose()

asset.dispose()
loader.dispose()
assets.dispose()
console.log('Sekai64 RC.31 MToon / VRM character-fidelity regression checks passed.')
