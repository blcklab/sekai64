import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PRODUCT_VISUAL_PRESET, toneMap } from '../dist/renderer/VisualPipeline.js'

assert.equal(PRODUCT_VISUAL_PRESET.colorManagement.toneMapping, 'neutral')
assert.ok(PRODUCT_VISUAL_PRESET.colorManagement.exposure < 1)
assert.ok(toneMap(0.18, 'neutral') > 0.1)
assert.ok(toneMap(4, 'neutral') < 1)
const gl=fs.readFileSync(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url),'utf8')
const gpu=fs.readFileSync(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url),'utf8')
for(const source of [gl,gpu]){
  assert.match(source,/pbrNeutralToneMap/)
  assert.match(source,/0\.76/)
  assert.match(source,/applyColorGrading\(applyAtmosphere/)
}
console.log('Sekai64 RC.25 product-fidelity regression checks passed.')
