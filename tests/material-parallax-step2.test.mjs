import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { StandardMaterial, Texture } from '../dist/materials/index.js'
import { DEFAULT_IMAGE_QUALITY, resolveImageQuality } from '../dist/renderer/index.js'

test('Step 2 height detail is optional and old material defaults remain inert', () => {
  const material = new StandardMaterial()
  assert.equal(material.detailHeightTexture, undefined)
  assert.equal(material.detailHeightScale, 0.02)
  assert.equal(DEFAULT_IMAGE_QUALITY.surfaceDetail, 'balanced')
})

test('Step 2 source-backed height maps use mip filtering and clamp displacement intent', () => {
  const material = new StandardMaterial({
    textureWrap: 'repeat',
    detail: { heightTexture: './brick-height.webp', scale: 12, heightScale: 0.035 },
  })
  assert.ok(material.detailHeightTexture instanceof Texture)
  assert.equal(material.detailHeightTexture.generateMipmaps, true)
  assert.equal(material.detailHeightTexture.minFilter, 'linear-mipmap-linear')
  assert.equal(material.detailHeightTexture.wrapS, 'repeat')
  assert.equal(material.detailHeightScale, 0.035)
  material.dispose()
})

test('Step 2 renderer surface-detail quality policy resolves deterministically', () => {
  assert.equal(resolveImageQuality({ surfaceDetail: 'off' }).surfaceDetail, 'off')
  assert.equal(resolveImageQuality({ surfaceDetail: 'balanced' }).surfaceDetail, 'balanced')
  assert.equal(resolveImageQuality({ surfaceDetail: 'high' }).surfaceDetail, 'high')
  assert.equal(resolveImageQuality({ surfaceDetail: /** @type {any} */ ('invalid') }).surfaceDetail, 'balanced')
})

test('Step 2 WebGL2 and WebGPU shaders contain matching lightweight parallax and specular stabilization paths', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  for (const source of [webgl, webgpu]) {
    assert.match(source, /detailHeight/)
    assert.match(source, /surfaceDetailParams/)
    assert.match(source, /surfaceUv/)
    assert.match(source, /variance/)
    assert.match(source, /surfaceDetailParams\.y>0\.0/)
    assert.doesNotMatch(source, /parallaxOcclusion|POM_STEPS|raymarch/i)
  }
  assert.match(webgl, /u_surfaceDetailParams\.x>1\.5/)
  assert.match(webgpu, /uniforms\.surfaceDetailParams\.x>1\.5/)
  assert.match(webgpu, /surfaceUv\(input:VertexOutput,index:f32,frontFacing:bool\)/)
  assert.match(webgpu, /if\(!frontFacing\)\{n=-n;\}/)
})
