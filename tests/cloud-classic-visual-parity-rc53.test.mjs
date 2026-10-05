import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveProceduralCloudState } from '../dist/renderer/index.js'

const gl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const gpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

test('rc53 dynamic defaults return to the accepted rc43 cloud visual vocabulary', () => {
  const state = resolveProceduralCloudState({ enabled: true })
  assert.equal(state.warpStrength, 0)
  assert.equal(state.horizonVisibility, 0)
  assert.equal(state.horizonSoftness, 0.14)
  assert.equal(state.highlightStrength, 0.9)
  assert.equal(state.silverLiningStrength, 0.26)
  assert.deepEqual(state.ambientColor, [0.9, 0.96, 1.08])
  assert.deepEqual(state.shadowColor, [0.64, 0.72, 0.92])
  assert.deepEqual(state.lightColor, [1.34, 1.22, 1.08])
})

test('rc53 WebGL2/WebGPU use rc43-inspired continuous perspective coordinates and field weights', () => {
  for (const source of [gl, gpu]) {
    assert.match(source, /0\.72\+0\.38\/max\(0\.22/)
    assert.match(source, /0\.36\*macroScale/)
    assert.match(source, /0\.92\*macroScale/)
    assert.match(source, /2\.35\*detailScale/)
    assert.match(source, /0\.18\*detailGain/)
    assert.match(source, /0\.06\*detailGain/)
    assert.match(source, /mix\(0\.79,0\.37/)
    assert.match(source, /classicFbm/)
  }
})

test('rc53 keeps runtime uniqueness and motion controls additive', () => {
  for (const source of [gl, gpu]) {
    assert.match(source, /cloudMotion/)
    assert.match(source, /cloudDetailMotion/)
    assert.match(source, /evolution/)
    assert.match(source, /underlapDistance/)
  }
})
