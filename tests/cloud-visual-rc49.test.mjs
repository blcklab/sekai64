import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createProceduralCloudNoise } from '../dist/renderer/index.js'

const sources = await Promise.all([
  readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
])

test('dynamic clouds preserve macro masses and keep fine noise world-tunable and bounded', () => {
  for (const source of sources) {
    assert.match(source, /cloudMacroField/)
    assert.match(source, /cloudDetailField/)
    assert.match(source, /classicFbm/)
    assert.match(source, /0\.18\*detailGain/)
    assert.match(source, /0\.06\*detailGain/)
    assert.match(source, /cloudShape\.z|u_cloudShape\.z/)
    assert.match(source, /abs\(small\*2\.0-1\.0\)/)
  }
})

test('dynamic clouds retain horizon presence instead of disappearing behind a hard fade', () => {
  for (const source of sources) {
    assert.match(source, /classicHorizon/)
    assert.match(source, /horizonPresence/)
    assert.match(source, /horizonVisibility|cloudHorizon\.y|u_cloudHorizon\.y/)
    assert.doesNotMatch(source, /horizonFade=smoothstep\(0\.01,0\.11/)
  }
})

test('cloud lighting stays macro-derived while shadow, highlight, and silver lining are authorable', () => {
  for (const source of sources) {
    assert.match(source, /cloudMacroField\(macroBase\+/)
    assert.match(source, /gx\*4\.6/)
    assert.match(source, /threshold\+0\.035/)
    assert.match(source, /pow\(sunFacing,5\.0\)/)
    assert.match(source, /cloudLighting|u_cloudLighting/)
    assert.match(source, /cloudHorizon\.w|u_cloudHorizon\.w/)
  }
})

test('seed texture channels are spatially coherent instead of raw per-texel noise', () => {
  const size = 128
  const noise = createProceduralCloudNoise(731927, size)
  const meanNeighborDelta = (channel) => {
    let sum = 0
    let count = 0
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const left = noise[(y * size + x) * 4 + channel]
        const right = noise[(y * size + ((x + 1) % size)) * 4 + channel]
        sum += Math.abs(left - right)
        count += 1
      }
    }
    return sum / count
  }
  assert.ok(meanNeighborDelta(0) < 4, 'macro channel should remain very smooth')
  assert.ok(meanNeighborDelta(1) < 9, 'medium channel should remain spatially coherent')
  assert.ok(meanNeighborDelta(2) < 16, 'detail channel should not regress to raw pixel noise')
  assert.ok(meanNeighborDelta(3) < 7, 'warp channel should remain smooth')
})
