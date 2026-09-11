import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const [glPost, gpuPost, glRenderer, gpuRenderer, gltf, standard, advanced] = await Promise.all([
  read('packages/renderer-webgl2/src/WebGLPostProcessPipeline.ts'),
  read('packages/renderer-webgpu/src/WebGPUPostProcessPipeline.ts'),
  read('packages/renderer-webgl2/src/WebGL2Renderer.ts'),
  read('packages/renderer-webgpu/src/WebGPURenderer.ts'),
  read('packages/gltf/src/GltfLoader.ts'),
  read('packages/materials/src/StandardMaterial.ts'),
  read('packages/renderer/src/AdvancedRendering.ts'),
])
for (const source of [glPost, gpuPost]) {
  assert.match(source, /GTAO|gtao|depthNormal|depth_normal/i)
  assert.match(source, /bilateral|denoise/i)
  assert.match(source, /createBloomPyramid/)
  assert.match(source, /fxaa/i)
}
assert.match(glRenderer, /drawInvertedHull/)
assert.match(gpuRenderer, /getOutlinePipeline/)
for (const source of [glRenderer, gpuRenderer]) {
  assert.match(source, /environmentTexture/)
  assert.match(source, /faceShadowTexture/)
  assert.match(source, /HierarchicalDepthCuller/)
  assert.match(source, /ClusteredLightGrid/)
  assert.match(source, /TextureResidencyManager/)
}
assert.match(gltf, /batchStaticMeshes/)
assert.match(gltf, /SEKAI64_face_shadow/)
assert.match(standard, /hairAlphaDither/)
assert.match(advanced, /class HierarchicalDepthCuller/)
assert.match(advanced, /class ClusteredLightGrid/)
assert.match(advanced, /class TextureResidencyManager/)
console.log('Sekai64 Anime-RPG pass 2 source coverage assertions passed.')
