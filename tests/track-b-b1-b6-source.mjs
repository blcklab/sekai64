import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const root=new URL('../',import.meta.url);const read=path=>readFile(new URL(path,root),'utf8')
const [standard,gltf,gl,gpu,glPost,gpuPost,texture,sky,prefilter,shadow]=await Promise.all([
 read('packages/materials/src/StandardMaterial.ts'),read('packages/gltf/src/GltfLoader.ts'),
 read('packages/renderer-webgl2/src/WebGL2Renderer.ts'),read('packages/renderer-webgpu/src/WebGPURenderer.ts'),
 read('packages/renderer-webgl2/src/WebGLPostProcessPipeline.ts'),read('packages/renderer-webgpu/src/WebGPUPostProcessPipeline.ts'),
 read('packages/texture-tools/src/TexturePipeline.ts'),read('packages/environment-authoring/src/ProceduralSky.ts'),read('packages/environment-authoring/src/EnvironmentPrefilter.ts'),read('packages/renderer/src/ShadowQuality.ts'),
])
for(const source of [standard,gltf,gl,gpu]){assert.match(source,/clearcoat/i);assert.match(source,/sheen/i);assert.match(source,/lightMap/i)}
for(const source of [gl,gpu]){assert.match(source,/pcf5|shadowQuality/i);assert.match(source,/cascadeBlend|shadowQuality/i);assert.match(source,/water/i)}
assert.match(shadow,/poisson/i)
for(const source of [glPost,gpuPost]){assert.match(source,/sampleLut/i);assert.match(source,/bloom/i);assert.match(source,/gtao|depthNormal/i)}
assert.match(texture,/TextureDecoderRegistry/);assert.match(texture,/alphaCoverage/i)
assert.match(sky,/createProceduralSky/);assert.match(prefilter,/packPrefilteredEnvironment/)
console.log('Sekai64 Track B B1-B6 source coverage assertions passed.')
