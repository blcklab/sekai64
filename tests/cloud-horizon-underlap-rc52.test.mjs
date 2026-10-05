import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolveProceduralCloudState } from '../dist/renderer/index.js'

const webgl=await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts',import.meta.url),'utf8')
const webgpu=await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts',import.meta.url),'utf8')

test('rc52 resolves bounded generic horizon-underlap controls',()=>{
  const state=resolveProceduralCloudState({horizonExtension:0.12,horizonCompression:0.7,horizonAtmosphericFade:0.8})
  assert.equal(state.horizonExtension,0.12)
  assert.equal(state.horizonCompression,0.7)
  assert.equal(state.horizonAtmosphericFade,0.8)
  const bounded=resolveProceduralCloudState({horizonExtension:9,horizonCompression:-1,horizonAtmosphericFade:3})
  assert.equal(bounded.horizonExtension,0.35)
  assert.equal(bounded.horizonCompression,0)
  assert.equal(bounded.horizonAtmosphericFade,1)
})

test('rc52 continues cloud sampling below the mathematical horizon and fades before the lower world',()=>{
  for(const source of [webgl,webgpu]){
    assert.match(source,/direction\.y<=-horizonExtension/)
    assert.match(source,/underlapFade/)
    assert.match(source,/underlapDistance/)
    assert.match(source,/horizonCompression/)
    assert.doesNotMatch(source,/direction\.y<=0\.0[^\n]*return vec4/)
  }
})

test('rc52 keeps clouds in the environment background pass so scene geometry remains in front',()=>{
  for(const source of [webgl,webgpu]){
    assert.match(source,/background.*proceduralCloud|proceduralCloud\(direction/)
    assert.match(source,/environmentUv\(direction\)/)
  }
})

test('rc52 WebGL2 and WebGPU pack the same horizon-underlap controls',()=>{
  assert.match(webgl,/clouds\.horizonExtension, clouds\.horizonCompression/)
  assert.match(webgl,/clouds\.horizonAtmosphericFade/)
  assert.match(webgpu,/clouds\.horizonExtension, clouds\.horizonCompression/)
  assert.match(webgpu,/clouds\.horizonAtmosphericFade/)
})
