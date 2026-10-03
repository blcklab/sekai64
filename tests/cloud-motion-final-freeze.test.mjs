import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { createProceduralCloudNoise, resolveProceduralCloudState } from '../dist/renderer/index.js'

test('final cloud freeze keeps deterministic unique seed noise with bounded runtime state', () => {
  const first = createProceduralCloudNoise(42, 128)
  const second = createProceduralCloudNoise(42, 128)
  const changed = createProceduralCloudNoise(43, 128)
  assert.deepEqual(first, second)
  assert.notDeepEqual(first, changed)
  assert.equal(first.length, 128 * 128 * 4)

  const state = resolveProceduralCloudState({ enabled: true, coverage: 2, density: -1, scale: 0, seed: 77, offset: [2.5, -4], evolution: 9, sunDirection: [0, 2, 0], sunIntensity: -3 })
  assert.equal(state.enabled, true)
  assert.equal(state.coverage, 1)
  assert.equal(state.density, 0)
  assert.equal(state.scale, 0.1)
  assert.deepEqual(state.offset, [2.5, -4])
  assert.equal(state.evolution, 9)
  assert.deepEqual(state.sunDirection, [0, 1, 0])
  assert.equal(state.sunIntensity, 0)
})

test('final cloud freeze generates seeded GPU noise cheaply and without per-frame CPU sky regeneration', () => {
  const started = performance.now()
  for (let index = 0; index < 16; index += 1) createProceduralCloudNoise(1000 + index, 128)
  const elapsed = performance.now() - started
  assert.ok(elapsed < 1000, `16 procedural cloud-noise generations took ${elapsed.toFixed(1)}ms`)
})

test('WebGL2 and WebGPU background paths expose the same dynamic cloud state without a CloudSystem', async () => {
  const [webgl, webgpu, renderer] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer/src/ProceduralClouds.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [webgl, webgpu]) {
    assert.match(source, /setProceduralClouds/)
    assert.match(source, /cloudMotion/)
    assert.match(source, /cloudSun/)
    assert.match(source, /createProceduralCloudNoise/)
    for (const forbidden of ['CloudSystem', 'CloudManager', 'CloudEntity', 'CloudPass']) assert.doesNotMatch(source, new RegExp(forbidden))
  }
  assert.match(webgl, /TEXTURE_WRAP_S, gl\.REPEAT/)
  assert.match(webgpu, /addressModeU: 'repeat'/)
  assert.match(renderer, /offset: readonly \[number, number\]/)
  assert.match(renderer, /evolution: number/)
})

test('cloud motion changes are uniform-only while seed changes own noise texture identity', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  assert.match(webgl, /cloudNoiseSeed === this\.proceduralClouds\.seed/)
  assert.match(webgpu, /cloudNoiseSeed === this\.proceduralClouds\.seed/)
  assert.match(webgl, /gl\.uniform4f\(program\.cloudMotion/)
  assert.match(webgpu, /values\.set\(\[clouds\.offset\[0\], clouds\.offset\[1\], clouds\.evolution/)
})
