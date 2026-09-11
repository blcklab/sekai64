import assert from 'node:assert/strict'
import { AssetManager } from '../dist/assets/index.js'
import { GltfLoader, GLTF_LOADER_CAPABILITIES } from '../dist/gltf/index.js'

function makeSparseGlb() {
  const sparseIndices = new Uint8Array([1, 2, 0, 0])
  const sparseValues = new Float32Array([1, 0, 0, 0, 1, 0])
  const bin = new Uint8Array(sparseIndices.byteLength + sparseValues.byteLength)
  bin.set(sparseIndices, 0)
  bin.set(new Uint8Array(sparseValues.buffer), sparseIndices.byteLength)
  const document = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 2 },
      { buffer: 0, byteOffset: 4, byteLength: sparseValues.byteLength },
    ],
    accessors: [{
      componentType: 5126,
      count: 3,
      type: 'VEC3',
      sparse: {
        count: 2,
        indices: { bufferView: 0, componentType: 5121 },
        values: { bufferView: 1 },
      },
    }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }
  const json = new TextEncoder().encode(JSON.stringify(document))
  const jsonLen = Math.ceil(json.length / 4) * 4
  const binLen = Math.ceil(bin.length / 4) * 4
  const total = 12 + 8 + jsonLen + 8 + binLen
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, jsonLen, true)
  view.setUint32(16, 0x4e4f534a, true)
  out.set(json, 20)
  out.fill(0x20, 20 + json.length, 20 + jsonLen)
  const binHeader = 20 + jsonLen
  view.setUint32(binHeader, binLen, true)
  view.setUint32(binHeader + 4, 0x004e4942, true)
  out.set(bin, binHeader + 8)
  return out.buffer
}

assert.equal(GLTF_LOADER_CAPABILITIES.sparseAccessors, true)
assert.equal(GLTF_LOADER_CAPABILITIES.browserDracoAutoDecode, true)
const fixture = makeSparseGlb()
const assets = new AssetManager()
assets.addResolver({
  canResolve: url => url.href === 'https://test.local/sparse.vrm',
  async fetch() { return new Response(fixture, { status: 200 }) },
})
const loader = new GltfLoader(assets)
const asset = await loader.load('https://test.local/sparse.vrm', { draco: false })
const mesh = asset.scene.findByTag('gltf-mesh')[0]
assert.ok(mesh)
assert.deepEqual(Array.from(mesh.geometry.positions), [0,0,0, 1,0,0, 0,1,0])
asset.dispose()
loader.dispose()
assets.dispose()
console.log('Sekai64 RC.28 sparse accessor / VRM compatibility checks passed.')
