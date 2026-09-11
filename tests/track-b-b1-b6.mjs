import assert from 'node:assert/strict'
import { StandardMaterial, WaterMaterial } from '@sekai64-internal/materials'
import { TextureDecoderRegistry, generateRgba8MipChain } from '@sekai64-internal/texture-tools'
import { createIdentityColorLut, parseCubeLut, sampleColorLut, packColorLutStrip, createShadowFilterKernel, selectShadowCascade, shadowDistanceFade, resolveColorGrading } from '@sekai64-internal/renderer'
import { createProceduralSky, prefilterEnvironment, packPrefilteredEnvironment } from '@sekai64-internal/environment-authoring'
import { EnvironmentResource } from '@sekai64-internal/environment'

const material = new StandardMaterial({
  shadingModel: 'pbr', clearcoat: 0.8, clearcoatRoughness: 0.2,
  specularFactor: 0.7, specularColor: '#d9efff', sheenColor: '#ffd6e9', sheenIntensity: 0.5,
  lightMapTexture: { kind: 'data', width: 1, height: 1, data: new Uint8Array([255,255,255,255]), format: 'rgba8unorm-srgb' },
  lightMapIntensity: 1.2, alphaDither: true,
})
assert.equal(material.clearcoat, 0.8)
assert.equal(material.lightMapIntensity, 1.2)
assert.equal(material.alphaDither, true)
const water = new WaterMaterial({ shallowColor: '#4dc2e8', deepColor: '#073d70', reflectionStrength: 0.9 })
assert.equal(water.shadingModel, 'water')
assert.equal(water.waterReflectionStrength, 0.9)

const pixels = new Uint8Array(4 * 4 * 4).fill(255)
const mips = generateRgba8MipChain(4, 4, pixels, { srgb: true, alphaCoverageCutoff: 0.5 })
assert.deepEqual(mips.map(level => [level.width, level.height]), [[2,2],[1,1]])
const decoders = new TextureDecoderRegistry()
const unregister = decoders.register({ id: 'test-ktx2', formats: ['ktx2'], async decode(){ return { width: 1, height: 1, data: new Uint8Array([1,2,3,255]) } } })
assert.equal(decoders.supports('.KTX2'), true)
assert.equal((await decoders.decode({ format: 'ktx2', data: new ArrayBuffer(0) })).kind, 'data')
unregister(); await decoders.disposeAsync()

const identity = createIdentityColorLut(4)
assert.deepEqual(sampleColorLut(identity, [0.2,0.5,0.8]).map(value=>Math.round(value*1000)), [200,500,800])
assert.equal(packColorLutStrip(identity).width, 16)
const parsed = parseCubeLut('LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1')
assert.equal(resolveColorGrading({ enabled: true, lut: parsed.lut, lutIntensity: 0.75 }).lutIntensity, 0.75)

assert.equal(createShadowFilterKernel('pcf5').length, 25)
assert.equal(createShadowFilterKernel('poisson').length, 16)
assert.equal(selectShadowCascade(9.8, [10,30,80], 0.2).secondary, 1)
assert.ok(shadowDistanceFade(95,100,0.1) < 1)

const sky = createProceduralSky({ width: 16, height: 8, cloudSeed: 42, cloudCoverage: 0.2 })
assert.equal(sky.pixels.length, 16*8*3)
const prefiltered = prefilterEnvironment(sky, { diffuseWidth: 4, specularWidth: 8, levels: 4, sampleCount: 4 })
const packed = packPrefilteredEnvironment(prefiltered)
assert.equal(packed.mipLevels?.length, 3)
assert.equal(packed.width, 8)
assert.equal(packed.format, 'rgba16f-linear')
assert.ok(packed.pixels instanceof Float32Array)
assert.ok(packed.diffuse?.pixels instanceof Float32Array)
assert.ok(packed.brdfLut?.pixels instanceof Float32Array)
const hdrProbe = new EnvironmentResource({ id: 'hdr-probe', width: 2, height: 1, pixels: new Float32Array([8,4,2, 0.25,0.5,1]) })
const hdrPacked = packPrefilteredEnvironment(prefilterEnvironment(hdrProbe, { diffuseWidth: 2, specularWidth: 2, levels: 1, sampleCount: 4, brdfSize: 2, brdfSampleCount: 8 }))
assert.ok(hdrPacked.pixels instanceof Float32Array && hdrPacked.pixels.some(value => value > 1), 'HDR prefilter packing must preserve values above display white')
hdrProbe.dispose()
sky.dispose(); material.dispose(); water.dispose()
console.log('Sekai64 Track B B1-B6 behavior assertions passed.')
