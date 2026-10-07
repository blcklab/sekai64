import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [webgl, webgpu] = await Promise.all([
  readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
])

test('rc56 WebGPU MToon shade texture uses its authored texCoord like WebGL2', () => {
  assert.match(webgl, /texture\(u_metallicMap,surfaceUv\(u_metallicTexCoord\)\)\.rgb/)
  assert.match(webgpu, /textureSample\(metallicTexture,metallicSampler,uvSet\(input,uniforms\.textureFlags3\.z\)\)\.rgb/)
  assert.doesNotMatch(webgpu, /textureSample\(metallicTexture,metallicSampler,uvSet\(input,uniforms\.textureCoords\.w\)\)\.rgb/)
})

test('rc56 WebGPU packs MToon shade texCoord into textureFlags3.z', () => {
  assert.match(webgpu, /uniform\.values\.set\(\[surface\.metallic\.texture\?\.ready \? 1 : 0, surface\.roughness\.texture\?\.ready \? 1 : 0, surface\.metallic\.texCoord, surface\.roughness\.texCoord\], 76\)/)
  assert.match(webgpu, /metallic: mtoon \? emptyBinding\(material\.mtoonShadeTexture, material\.mtoonShadeTexCoord\)/)
})
