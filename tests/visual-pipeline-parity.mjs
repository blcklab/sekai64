import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
for (const [name, source] of [['WebGL2', webgl], ['WebGPU', webgpu]]) {
  for (const feature of ['toneMap', 'distributionGGX', 'shadow', 'transmission', 'environment']) {
    assert.match(source.toLowerCase(), new RegExp(feature.toLowerCase()), `${name} is missing ${feature}`)
  }
  assert.match(source, /metallicTexture/)
  assert.match(source, /roughnessTexture/)
}
assert.match(webgl, /outputTransform/)
assert.match(webgpu, /outputTransform/)

assert.match(webgl, /envKd\*base\*env\*ao\/PI/, 'WebGL2 environment diffuse must be energy conserving and Lambert-normalized')
assert.match(webgpu, /envKd\*base\*env\*ao\/PI/, 'WebGPU environment diffuse must be energy conserving and Lambert-normalized')
assert.match(webgl, /u_environmentBrdfLut/)
assert.match(webgpu, /environmentBrdfTexture/)
assert.match(webgl, /transpose\(inverse\(model3\)\)/, 'WebGL2 normals must use inverse-transpose transforms')
assert.match(webgpu, /cofactor0=cross/, 'WebGPU normals must use an inverse-transpose equivalent')
console.log('Sekai64 S1–S7 WebGL2/WebGPU shader feature parity verification passed.')
