import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dynamic = await readFile(new URL('../packages/dynamic-texture/src/DynamicTexture.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

assert.doesNotMatch(dynamic, /SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE/)
assert.match(dynamic, /const mipmaps = options\.mipmaps \?\? 'none'/)
assert.match(webgpu, /cached\.mipLevelCount > 1[\s\S]*generateWebGpuMipmaps\(device, cached\.texture/)
assert.match(webgpu, /format: GPUTextureFormat = texture\.colorSpace === 'srgb'/)
assert.match(webgpu, /maxAnisotropy/)

console.log('Sekai64 dynamic WebGPU mipmap refresh contract verified.')
