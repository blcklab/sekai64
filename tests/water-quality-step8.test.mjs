import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { StandardMaterial } from '../dist/materials/index.js'

test('Step 8 water motion is opt-in and preserves legacy static defaults', () => {
  const legacy = new StandardMaterial({ shadingModel: 'water' })
  assert.equal(legacy.waterWaveStrength, 0)
  assert.equal(legacy.waterWaveScale, 0.45)
  assert.equal(legacy.waterWaveSpeed, 0.35)
  assert.equal(legacy.waterFoamStrength, 0.18)
  assert.ok(Math.abs(Math.hypot(...legacy.waterFlowDirection) - 1) < 1e-12)

  const enhanced = new StandardMaterial({
    shadingModel: 'water',
    ior: 1.333,
    transmission: 0.76,
    water: { waveScale: 0.7, waveStrength: 0.12, waveSpeed: 0.8, flowDirection: [3, 4], foamStrength: 0.09 },
  })
  assert.equal(enhanced.waterWaveScale, 0.7)
  assert.equal(enhanced.waterWaveStrength, 0.12)
  assert.equal(enhanced.waterWaveSpeed, 0.8)
  assert.deepEqual(enhanced.waterFlowDirection, [0.6, 0.8])
  assert.equal(enhanced.waterFoamStrength, 0.09)
})

test('Step 8 WebGL2 and WebGPU share renderer-owned animated water semantics', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [webgl, webgpu]) {
    assert.match(source, /waterMotion/)
    assert.match(source, /waterFlowTime/)
    assert.match(source, /waterAnimatedUv/)
    assert.match(source, /waterMacroNormal/)
    assert.match(source, /dielectricF0/)
    assert.match(source, /transmissionAlpha/)
    assert.match(source, /foamStrength|waterMotion\.w/)
    assert.doesNotMatch(source, /WaterSystem|OceanSystem|RiverSystem|LakeSystem/)
  }
  assert.match(webgl, /step\(0\.0001,u_waterMotion\.y\)/)
  assert.match(webgpu, /select\(0\.0,1\.0,uniforms\.waterMotion\.y>0\.0001\)/)
  assert.match(webgl, /this\.waterTimeSeconds/)
  assert.match(webgpu, /this\.waterTimeSeconds/)
})

test('Step 8 renderer clocks are bounded and do not expose shader timing to world authoring', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [webgl, webgpu]) {
    assert.match(source, /Math\.min\(0\.25/)
    assert.match(source, /%4096/)
  }
})
