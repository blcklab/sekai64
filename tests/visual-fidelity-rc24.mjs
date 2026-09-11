import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GltfLoader } from '@blcklab/sekai64/gltf'

const gltfSource = await readFile(new URL('../packages/gltf/src/GltfLoader.ts', import.meta.url), 'utf8')
const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

assert.match(gltfSource, /linearFactor4ToSrgb\(baseLinear\)/, 'glTF baseColorFactor must be treated as linear data')
assert.match(gltfSource, /linearFactor3ToSrgb\(emissiveLinear\)/, 'glTF emissiveFactor must be treated as linear data')
assert.match(webgl, /srgbToLinear\(tint\.rgb\)\*v_color\.rgb\*sampled\.rgb/, 'WebGL2 must keep glTF vertex colors and GPU-decoded sRGB textures in linear space')
assert.match(webgpu, /srgbToLinear\(tint\.rgb\)\*input\.color\.rgb\*sampled\.rgb/, 'WebGPU must match WebGL2 base-color color-space semantics')
assert.doesNotMatch(webgpu, /srgbToLinear\(surface\.rgb\)/, 'WebGPU must not double-decode a sampled sRGB base-color texture')
console.log('Sekai64 rc.24 glTF color-space fidelity verification passed.')
