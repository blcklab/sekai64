import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createProceduralCloudNoise } from '../dist/renderer/index.js'

const sources = await Promise.all([
  readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
])

test('dynamic clouds preserve macro masses and use fine noise only as bounded detail', () => {
  for (const source of sources) {
    assert.match(source, /cloudMacroField/)
    assert.match(source, /cloudDetailField/)
    assert.match(source, /large\*0\.72\+medium\*0\.28/)
    assert.match(source, /detail-0\.5/)
    assert.match(source, /0\.10\*detailStrength/)
    assert.doesNotMatch(source, /abs\(small\*2\.0-1\.0\)/)
  }
})

test('dynamic clouds keep the rc49 bounded horizon/detail treatment', () => {
  for (const source of sources) {
    assert.match(source, /horizonFade/)
    assert.match(source, /detailStrength/)
    assert.doesNotMatch(source, /0\.72\+0\.38\/max\(0\.22/)
  }
})

test('cloud lighting is derived from macro shape with restrained normals and edge-only silver lining', () => {
  for (const source of sources) {
    assert.match(source, /cloudMacroField\(base\+/)
    assert.match(source, /gx\*1\.6/)
    assert.match(source, /4\.0\*body\*\(1\.0-body\)/)
    assert.match(source, /pow\(sunFacing,7\.0\)\*0\.09/)
    assert.doesNotMatch(source, /gx\*4\.6/)
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
