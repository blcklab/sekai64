import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { StandardMaterial } from '../dist/materials/StandardMaterial.js'

test('StandardMaterial keeps texture transforms lightweight and identity by default', () => {
  const material = new StandardMaterial()
  assert.deepEqual(material.textureScale, [1, 1])
  assert.deepEqual(material.textureOffset, [0, 0])
  assert.equal(material.textureRotation, 0)
  assert.equal(material.textureWrapS, 'clamp-to-edge')
  assert.equal(material.textureWrapT, 'clamp-to-edge')

  material.setTextureTransform({ scale: [3, 2], offset: [0.25, -0.5], rotation: Math.PI / 4 })
  assert.deepEqual(material.textureScale, [3, 2])
  assert.deepEqual(material.textureOffset, [0.25, -0.5])
  assert.equal(material.textureRotation, Math.PI / 4)
})


test('StandardMaterial applies authored repeat wrapping to source-backed texture channels', () => {
  const material = new StandardMaterial({ baseColorTexture: './stone.webp', textureWrap: 'repeat' })
  assert.equal(material.textureWrapS, 'repeat')
  assert.equal(material.textureWrapT, 'repeat')
  assert.equal(material.baseColorTexture.wrapS, 'repeat')
  assert.equal(material.baseColorTexture.wrapT, 'repeat')

  const directional = new StandardMaterial({ normalTexture: './stone-normal.webp', textureWrap: { s: 'mirror-repeat', t: 'repeat' } })
  assert.equal(directional.normalTexture.wrapS, 'mirror-repeat')
  assert.equal(directional.normalTexture.wrapT, 'repeat')
})

test('invalid direct texture transforms fall back to a safe identity instead of poisoning shaders', () => {
  const material = new StandardMaterial({ textureTransform: { scale: [0, 2], offset: [Number.NaN, 1], rotation: Number.POSITIVE_INFINITY } })
  assert.deepEqual(material.textureScale, [1, 1])
  assert.deepEqual(material.textureOffset, [0, 0])
  assert.equal(material.textureRotation, 0)
})

test('WebGL2 and WebGPU apply the same scale/rotation/offset UV transform', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  assert.match(webgl, /u_textureTransform/)
  assert.match(webgl, /u_textureRotation/)
  assert.match(webgl, /scaled=uv\*u_textureTransform\.xy/)
  assert.match(webgpu, /textureTransform: vec4<f32>/)
  assert.match(webgpu, /textureRotation: vec4<f32>/)
  assert.match(webgpu, /scaled=uv\*uniforms\.textureTransform\.xy/)
})
