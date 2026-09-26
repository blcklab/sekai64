import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { StandardMaterial } from '@blcklab/sekai64/materials'

const webgl = readFileSync(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = readFileSync(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

test('Step 6 keeps alpha stability renderer-owned and WebGL2/WebGPU equivalent', () => {
  const masked = new StandardMaterial({ alphaMode: 'mask', alphaCutoff: 0.47, doubleSided: true })
  assert.equal(masked.alphaMode, 'mask')
  assert.equal(masked.alphaCutoff, 0.47)
  assert.equal(masked.side, 'double')

  assert.match(webgl, /uniform bool u_alphaCoverage;/)
  assert.match(webgl, /gl\.enable\(gl\.SAMPLE_ALPHA_TO_COVERAGE\)/)
  assert.match(webgl, /surface\.alphaCutoff > 0 && this\.alphaToCoverageActive/)
  assert.match(webgl, /float edge=max\(fwidth\(alpha\),1\.0\/255\.0\)/)

  assert.match(webgpu, /let coverageMode=uniforms\.textureCoords\.w>0\.5/)
  assert.match(webgpu, /alphaToCoverageEnabled: alphaCoverage/)
  assert.match(webgpu, /surface\.alphaCutoff > 0 && this\.sampleCount > 1/)
  assert.match(webgpu, /let edge=max\(fwidth\(surfaceAlpha\),1\.0\/255\.0\)/)

  for (const forbidden of ['VegetationRenderer', 'LeafRenderer', 'GrassRenderer', 'HairRenderer']) {
    assert.equal(webgl.includes(forbidden), false)
    assert.equal(webgpu.includes(forbidden), false)
  }
})

test('Step 6 masked shadow casters preserve alpha, UV transforms, instance color, and double-sided cards', () => {
  assert.match(webgl, /uniform sampler2D u_baseColorMap;/)
  assert.match(webgl, /alpha\*=texture\(u_baseColorMap,surfaceUv\(u_baseColorTexCoord\)\)\.a/)
  assert.match(webgl, /v_color=a_color\*a_instanceColor/)
  assert.match(webgl, /entry\.material\.side==='double'\)gl\.disable\(gl\.CULL_FACE\)/)

  assert.match(webgpu, /var baseColorTexture:texture_2d<f32>/)
  assert.match(webgpu, /textureSample\(baseColorTexture,baseColorSampler,surfaceUv\(input\)\)\.a/)
  assert.match(webgpu, /output\.color=color\$\{instanced \? '\*instanceColor'/)
  assert.match(webgpu, /cullMode: doubleSided \? 'none' : 'front'/)
  assert.match(webgpu, /fragment: \{ module, entryPoint: 'fragment_main', targets: \[\] \}/)
})

test('Step 6 preserves mip-aware fallback instead of forcing alpha-to-coverage without MSAA', () => {
  assert.match(webgl, /Number\(gl\.getParameter\(gl\.SAMPLES\) \?\? 0\) > 1/)
  assert.match(webgl, /if\(u_alphaCoverage\)\{alpha=coverage;\}else\{if\(coverage<coverageNoise\)discard;alpha=1\.0;\}/)
  assert.match(webgpu, /if\(coverageMode\)\{surfaceAlpha=coverage;\}else\{if\(coverage<coverageNoise\)\{discard;\}surfaceAlpha=1\.0;\}/)
  assert.match(webgl, /interleavedGradientNoise\(gl_FragCoord\.xy\)/)
  assert.match(webgpu, /interleavedGradientNoise\(input\.position\.xy\)/)
})
