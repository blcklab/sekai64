import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { StandardMaterial, Texture } from '../dist/materials/index.js'

test('Step 1 material detail is optional and defaults to a zero-cost renderer path', () => {
  const material = new StandardMaterial()
  assert.equal(material.detailNormalTexture, undefined)
  assert.equal(material.detailRoughnessTexture, undefined)
  assert.equal(material.detailScale, 1)
  assert.equal(material.detailNormalStrength, 1)
  assert.equal(material.detailRoughnessStrength, 1)
})

test('Step 1 source-backed detail maps prefer repeat-safe mip filtering and preserve authored controls', () => {
  const material = new StandardMaterial({
    textureWrap: 'repeat',
    detail: {
      normalTexture: './concrete-detail-normal.webp',
      roughnessTexture: './concrete-detail-roughness.webp',
      scale: 18,
      strength: 0.28,
      roughnessStrength: 0.42,
    },
  })
  assert.ok(material.detailNormalTexture instanceof Texture)
  assert.ok(material.detailRoughnessTexture instanceof Texture)
  assert.equal(material.detailNormalTexture.generateMipmaps, true)
  assert.equal(material.detailRoughnessTexture.generateMipmaps, true)
  assert.equal(material.detailNormalTexture.minFilter, 'linear-mipmap-linear')
  assert.equal(material.detailRoughnessTexture.minFilter, 'linear-mipmap-linear')
  assert.equal(material.detailNormalTexture.wrapS, 'repeat')
  assert.equal(material.detailRoughnessTexture.wrapT, 'repeat')
  assert.equal(material.detailScale, 18)
  assert.equal(material.detailNormalStrength, 0.28)
  assert.equal(material.detailRoughnessStrength, 0.42)
  material.dispose()
})

test('Step 1 shader sources keep WebGL2 and WebGPU detail semantics in parity', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [webgl, webgpu]) {
    assert.match(source, /detailNormal/)
    assert.match(source, /detailRoughness/)
    assert.match(source, /detailParams/)
  }
  assert.match(webgl, /mapNormal\.xy\+detailNormal\.xy/)
  assert.match(webgpu, /mapNormal\.xy\+detailNormal\.xy/)
  assert.match(webgl, /roughness=mix\(roughness,detailRoughness/)
  assert.match(webgpu, /roughness=mix\(roughness,detailRoughness/)
})
