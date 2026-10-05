import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveProceduralCloudState } from '../dist/renderer/index.js'

const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

const authoringFields = [
  'macroScale', 'detailScale', 'detailStrength', 'edgeSoftness', 'warpStrength',
  'horizonVisibility', 'horizonSoftness', 'horizonExtension', 'horizonCompression', 'horizonAtmosphericFade', 'shadowStrength', 'highlightStrength',
  'silverLiningStrength', 'ambientColor', 'shadowColor', 'lightColor',
  'detailOffset', 'detailEvolution',
]

test('rc51 cloud authoring contract resolves all appearance and secondary-motion controls', () => {
  const state = resolveProceduralCloudState({
    enabled: true,
    macroScale: 0.8,
    detailScale: 1.3,
    detailStrength: 0.07,
    edgeSoftness: 0.12,
    warpStrength: 0.11,
    horizonVisibility: 0.76,
    horizonSoftness: 0.2,
    shadowStrength: 0.31,
    highlightStrength: 0.63,
    silverLiningStrength: 0.05,
    ambientColor: [0.9, 0.92, 1],
    shadowColor: [0.55, 0.62, 0.75],
    lightColor: [1.1, 1.04, 0.96],
    detailOffset: [0.2, -0.1],
    detailEvolution: 0.42,
  })
  for (const field of authoringFields) assert.ok(field in state, `missing ${field}`)
  assert.deepEqual(state.detailOffset, [0.2, -0.1])
  assert.equal(state.horizonVisibility, 0.76)
})

test('rc51 cloud authoring inputs are bounded to renderer-safe ranges', () => {
  const state = resolveProceduralCloudState({
    macroScale: -10,
    detailScale: 99,
    detailStrength: 9,
    edgeSoftness: 0,
    warpStrength: 9,
    horizonVisibility: -1,
    horizonSoftness: 9,
    shadowStrength: 9,
    highlightStrength: 9,
    silverLiningStrength: 9,
    ambientColor: [-1, 99, 0.5],
  })
  assert.equal(state.macroScale, 0.2)
  assert.equal(state.detailScale, 4)
  assert.equal(state.detailStrength, 0.5)
  assert.equal(state.edgeSoftness, 0.01)
  assert.equal(state.horizonVisibility, 0)
  assert.deepEqual(state.ambientColor, [0, 4, 0.5])
})

test('rc51 WebGL2 and WebGPU consume the same world-authored cloud controls', () => {
  for (const field of ['cloudShape', 'cloudHorizon', 'cloudLighting', 'cloudDetailMotion', 'cloudAmbientColor', 'cloudShadowColor', 'cloudLightColor']) {
    assert.match(webgl, new RegExp(field))
    assert.match(webgpu, new RegExp(field))
  }
  assert.match(webgl, /detailOffset/)
  assert.match(webgpu, /detailOffset/)
})

test('rc51 remains one background pass with no CloudSystem or per-cloud entity subsystem', () => {
  for (const source of [webgl, webgpu]) {
    assert.doesNotMatch(source, /class CloudSystem/)
    assert.doesNotMatch(source, /CloudManager/)
    assert.match(source, /proceduralCloud\(direction/)
  }
})
