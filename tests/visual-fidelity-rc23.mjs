import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EnvironmentResource } from '@blcklab/sekai64/environment'
import { packPrefilteredEnvironment, prefilterEnvironment } from '@blcklab/sekai64/environment-authoring'
import { PRODUCT_VISUAL_PRESET } from '@blcklab/sekai64/renderer'

const source = new EnvironmentResource({
  id: 'rc23-hdr-probe', width: 2, height: 2,
  pixels: new Float32Array([8,4,2, 0.2,0.3,0.4, 1,1,1, 0.05,0.05,0.05]),
})
const packed = packPrefilteredEnvironment(prefilterEnvironment(source, { diffuseWidth: 2, specularWidth: 2, levels: 1, sampleCount: 4, brdfSize: 2, brdfSampleCount: 8 }))
assert.equal(packed.format, 'rgba16f-linear')
assert.ok(packed.pixels instanceof Float32Array)
assert.ok(Math.max(...packed.pixels) > 1, 'HDR range must survive environment packing')
assert.ok(packed.diffuse?.pixels instanceof Float32Array)
assert.ok(packed.brdfLut?.pixels instanceof Float32Array)
assert.equal(PRODUCT_VISUAL_PRESET.environmentLighting.specularIntensity, 1)

const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
assert.doesNotMatch(webgl, /srgbToLinear\(textureLod\(u_environmentMap/)
assert.doesNotMatch(webgpu, /srgbToLinear\(textureSampleLevel\(environmentTexture/)
assert.match(webgl, /u_environmentBrdfLut/)
assert.match(webgpu, /environmentBrdfTexture/)
assert.match(webgl, /transpose\(inverse\(model3\)\)/)
assert.match(webgpu, /cofactor0=cross/)
assert.match(webgl, /dielectricF0=pow/)
assert.match(webgpu, /dielectricF0=pow/)
source.dispose()
console.log('Sekai64 RC.23 HDR IBL, BRDF, normal-transform, and product-preset regressions passed.')
