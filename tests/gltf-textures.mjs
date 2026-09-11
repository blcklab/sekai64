import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { AssetManager } from '@blcklab/sekai64/assets'
import { GLTF_LOADER_CAPABILITIES, GltfLoader, getBufferViewBytes } from '@blcklab/sekai64/gltf'
import { StandardMaterial } from '@blcklab/sekai64/materials'
import { createRendererFeatures } from '@blcklab/sekai64/renderer'

class FakeImageBitmap {
  width = 2
  height = 2
  closed = false
  close() { this.closed = true }
}
globalThis.ImageBitmap = FakeImageBitmap
globalThis.createImageBitmap = async () => new FakeImageBitmap()


assert.deepEqual([...GLTF_LOADER_CAPABILITIES.formats], ['gltf', 'glb', 'vrm'])
assert.deepEqual([...GLTF_LOADER_CAPABILITIES.materialTextures], ['baseColor', 'normal', 'metallicRoughness', 'emissive', 'occlusion', 'lightMap', 'faceShadow', 'mtoonShade', 'mtoonShadingShift', 'mtoonMatcap', 'mtoonRim'])
assert.equal(GLTF_LOADER_CAPABILITIES.vertexColors, true)
const rendererFeatures = createRendererFeatures()
assert.equal(rendererFeatures.baseColorTextures, true)
assert.equal(rendererFeatures.normalTextures, true)
assert.equal(rendererFeatures.metallicRoughnessTextures, true)
assert.equal(rendererFeatures.emissiveTextures, true)
assert.equal(rendererFeatures.occlusionTextures, true)
assert.equal(rendererFeatures.lightMapTextures, true)
assert.equal(rendererFeatures.clearcoat, true)
assert.equal(rendererFeatures.sheen, true)
assert.equal(rendererFeatures.waterMaterials, true)
assert.equal(rendererFeatures.vertexColors, true)
assert.equal(rendererFeatures.alphaMask, true)
assert.equal(rendererFeatures.alphaBlend, true)
assert.equal(rendererFeatures.doubleSidedMaterials, true)

const realEmbeddedFixture = await readFile(new URL('./fixtures/gltf/embedded-base-color.glb', import.meta.url))
const realFixtureLoader = loaderFor({
  'https://test.local/fixture.glb': new Response(realEmbeddedFixture, {
    status: 200,
    headers: { 'content-type': 'model/gltf-binary' }
  })
})
const realFixtureAsset = await realFixtureLoader.load('https://test.local/fixture.glb')
const realFixtureMaterial = realFixtureAsset.scene.findByTag('gltf-mesh')[0].material
assert.ok(realFixtureMaterial instanceof StandardMaterial)
assert.equal(realFixtureMaterial.baseColorTexture.ready, true)
realFixtureAsset.dispose()
realFixtureLoader.dispose()

const vrmLoader = loaderFor({
  'https://test.local/avatar.vrm': new Response(realEmbeddedFixture, {
    status: 200,
    headers: { 'content-type': 'model/gltf-binary' }
  })
})
const vrmAsset = await vrmLoader.load('https://test.local/avatar.vrm')
assert.equal(vrmAsset.document.asset.version, '2.0')
vrmAsset.dispose()
vrmLoader.dispose()

const mtoonFixture = makeGlbFixture({ channels: ['baseColor'], mtoon: true })
const mtoonLoader = loaderFor({ 'https://test.local/mtoon.vrm': new Response(mtoonFixture, { status: 200 }) })
const mtoonAsset = await mtoonLoader.load('https://test.local/mtoon.vrm')
const mtoonMaterial = mtoonAsset.scene.findByTag('gltf-mesh')[0].material
assert.ok(mtoonMaterial instanceof StandardMaterial)
assert.equal(mtoonMaterial.shadingModel, 'mtoon')
const mtoonShade = [mtoonMaterial.mtoonShadeColor.r, mtoonMaterial.mtoonShadeColor.g, mtoonMaterial.mtoonShadeColor.b]
const expectedMtoonShade = [0.36, 0.28, 0.42].map(linearToSrgb)
for (let i = 0; i < 3; i++) assert.ok(Math.abs(mtoonShade[i] - expectedMtoonShade[i]) < 1e-9)
assert.equal(mtoonMaterial.mtoonShadingShift, -0.12)
assert.equal(mtoonMaterial.mtoonShadingToony, 0.84)
assert.equal(mtoonMaterial.mtoonRimLightingMix, 0.72)
assert.equal(mtoonMaterial.mtoonOutlineWidth, 0.006)
mtoonAsset.dispose(); mtoonLoader.dispose()

const embedded = makeGlbFixture({ channels: ['baseColor'], sampler: { magFilter: 9728, minFilter: 9986, wrapS: 33071, wrapT: 33648 } })
const loader = loaderFor({ 'https://test.local/model.glb': new Response(embedded, { status: 200 }) })
const asset = await loader.load('https://test.local/model.glb')
const mesh = asset.scene.findByTag('gltf-mesh')[0]
const material = mesh.material
assert.ok(material instanceof StandardMaterial)
assert.equal(material.baseColorTexture.ready, true)
assert.equal(material.baseColorTexture.flipY, false)
assert.equal(material.baseColorTexture.colorSpace, 'srgb')
assert.equal(material.baseColorTexture.minFilter, 'nearest-mipmap-linear')
assert.equal(material.baseColorTexture.magFilter, 'nearest')
assert.equal(material.baseColorTexture.wrapS, 'clamp-to-edge')
assert.equal(material.baseColorTexture.wrapT, 'mirror-repeat')
const embeddedTexture = material.baseColorTexture
asset.dispose()
assert.equal(embeddedTexture.disposed, true)
loader.dispose()

const all = makeGlbFixture({ channels: ['baseColor', 'normal', 'metallicRoughness', 'emissive', 'occlusion', 'lightMap', 'faceShadow'], duplicatePrimitive: true })
const allLoader = loaderFor({ 'https://test.local/all.glb': new Response(all, { status: 200 }) })
const allAsset = await allLoader.load('https://test.local/all.glb')
const meshes = allAsset.scene.findByTag('gltf-mesh')
const first = meshes[0].material
const second = meshes[1].material
assert.equal(first.baseColorTexture.colorSpace, 'srgb')
assert.equal(first.emissiveTexture.colorSpace, 'srgb')
assert.equal(first.normalTexture.colorSpace, 'linear')
assert.equal(first.metallicRoughnessTexture.colorSpace, 'linear')
assert.equal(first.occlusionTexture.colorSpace, 'linear')
assert.equal(first.baseColorTexture, first.emissiveTexture)
assert.equal(first.normalTexture, first.metallicRoughnessTexture)
assert.equal(first.normalTexture, first.occlusionTexture)
assert.equal(second.baseColorTexture, first.baseColorTexture)
assert.equal(first.normalScale, 0.75)
assert.equal(first.occlusionStrength, 0.6)
assert.equal(first.alphaMode, 'mask')
assert.equal(first.doubleSided, true)
allAsset.dispose(); allLoader.dispose()

const dataFixture = makeGlbFixture({ channels: ['baseColor'], imageDataUri: true, texCoord: 1, includeColors: true, includeTangents: true })
const dataLoader = loaderFor({ 'https://test.local/data.glb': new Response(dataFixture, { status: 200 }) })
const dataAsset = await dataLoader.load('https://test.local/data.glb')
const dataMesh = dataAsset.scene.findByTag('gltf-mesh')[0]
assert.equal(dataMesh.material.baseColorTexCoord, 1)
assert.ok(dataMesh.geometry.uvs1 instanceof Float32Array)
assert.ok(dataMesh.geometry.tangents instanceof Float32Array)
assert.deepEqual([...dataMesh.geometry.colors], [1,0,0,1,0,1,0,1,0,0,1,1])
dataAsset.dispose(); dataLoader.dispose()

const positions = floatBytes([0,0,0,1,0,0,0,1,0])
const uvs = floatBytes([0,0,1,0,0,1])
const binary = concatBytes(positions, uvs)

const dataBufferDocument = makeDocument({
  bufferUri: `data:application/octet-stream;base64,${Buffer.from(binary).toString('base64')}`,
  bufferLength: binary.byteLength,
  image: { uri: 'data:image/png;base64,iVBORw0KGgo=' },
  channels: ['baseColor']
})
const dataBufferLoader = loaderFor({
  'https://test.local/data-buffer.gltf': jsonResponse(dataBufferDocument)
})
const dataBufferAsset = await dataBufferLoader.load('https://test.local/data-buffer.gltf')
assert.ok(dataBufferAsset.scene.findByTag('gltf-mesh')[0].material instanceof StandardMaterial)
dataBufferAsset.dispose(); dataBufferLoader.dispose()
const externalDocument = makeDocument({ bufferUri: 'mesh.bin', bufferLength: binary.byteLength, image: { uri: 'textures/base.webp' }, channels: ['baseColor', 'emissive'] })
const calls = []
const externalAssets = new AssetManager()
externalAssets.addResolver({
  canResolve: url => url.hostname === 'test.local',
  async fetch(url) {
    calls.push(url.href)
    if (url.pathname.endsWith('/model.gltf')) return jsonResponse(externalDocument)
    if (url.pathname.endsWith('/mesh.bin')) return new Response(binary, { status: 200 })
    if (url.pathname.endsWith('/textures/base.webp')) return new Response(new Blob([new Uint8Array([1,2,3])], { type: 'image/webp' }), { status: 200, headers: { 'content-type': 'image/webp' } })
    return new Response(null, { status: 404 })
  }
})
const externalLoader = new GltfLoader(externalAssets)
const externalAsset = await externalLoader.load('https://test.local/models/model.gltf')
const externalMaterial = externalAsset.scene.findByTag('gltf-mesh')[0].material
assert.equal(externalMaterial.baseColorTexture, externalMaterial.emissiveTexture)
assert.equal(calls.filter(value => value.endsWith('/textures/base.webp')).length, 1)
externalAsset.dispose(); externalLoader.dispose(); externalAssets.dispose()

const missingUv = makeGlbFixture({ channels: ['baseColor'], omitUvs: true })
const missingLoader = loaderFor({ 'https://test.local/missing.glb': new Response(missingUv, { status: 200 }) })
await assert.rejects(() => missingLoader.load('https://test.local/missing.glb'), /SEKAI_GLTF_UV_SET_MISSING/)
missingLoader.dispose()
assert.throws(() => getBufferViewBytes({ asset: { version: '2.0' }, bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 8 }] }, [new ArrayBuffer(4)], 0), /SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID/)


const originalCreateImageBitmap = globalThis.createImageBitmap
let releaseDecode
let signalDecodeStarted
const decodeStarted = new Promise(resolve => { signalDecodeStarted = resolve })
globalThis.createImageBitmap = async () => {
  signalDecodeStarted()
  return new Promise(resolve => { releaseDecode = resolve })
}
const abortFixture = makeGlbFixture({ channels: ['baseColor'] })
const abortLoader = loaderFor({ 'https://test.local/abort.glb': new Response(abortFixture, { status: 200 }) })
const abortController = new AbortController()
const abortedLoad = abortLoader.load('https://test.local/abort.glb', { signal: abortController.signal })
await decodeStarted
abortController.abort(new DOMException('Stopped by test.', 'AbortError'))
const lateBitmap = new FakeImageBitmap()
releaseDecode(lateBitmap)
await assert.rejects(abortedLoad, /Abort|aborted|Stopped by test/)
assert.equal(lateBitmap.closed, true)
abortLoader.dispose()
globalThis.createImageBitmap = originalCreateImageBitmap

console.log('Sekai64 glTF texture tests passed.')

function loaderFor(responses) {
  const assets = new AssetManager()
  assets.addResolver({
    canResolve: url => url.href in responses,
    async fetch(url) { return responses[url.href]?.clone() ?? new Response(null, { status: 404 }) }
  })
  const loader = new GltfLoader(assets)
  const dispose = loader.dispose.bind(loader)
  loader.dispose = () => { dispose(); assets.dispose() }
  return loader
}
function jsonResponse(value) { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } }) }
function makeGlbFixture(options) {
  const positionBytes = floatBytes([0,0,0,1,0,0,0,1,0])
  const uvBytes = floatBytes([0,0,1,0,0,1])
  const colorBytes = new Uint8Array([255,0,0,0,255,0,0,0,255])
  const tangentBytes = floatBytes([1,0,0,1,1,0,0,1,1,0,0,1])
  const imageBytes = new Uint8Array([137,80,78,71,13,10,26,10])
  const chunks = [positionBytes]
  const views = []
  let offset = 0
  views.push({ buffer: 0, byteOffset: offset, byteLength: positionBytes.byteLength }); offset += positionBytes.byteLength
  let uvView
  if (!options.omitUvs) { uvView = views.length; chunks.push(uvBytes); views.push({ buffer:0,byteOffset:offset,byteLength:uvBytes.byteLength }); offset += uvBytes.byteLength }
  let colorView
  if (options.includeColors) { colorView=views.length;chunks.push(colorBytes);views.push({buffer:0,byteOffset:offset,byteLength:colorBytes.byteLength});offset+=colorBytes.byteLength }
  let tangentView
  if (options.includeTangents) { const aligned=align4(offset);const pad=aligned-chunks.reduce((n,x)=>n+x.byteLength,0);if(pad>0)chunks.push(new Uint8Array(pad));offset=aligned;tangentView=views.length;chunks.push(tangentBytes);views.push({buffer:0,byteOffset:offset,byteLength:tangentBytes.byteLength});offset+=tangentBytes.byteLength }
  const aligned=align4(offset);const pad=aligned-chunks.reduce((n,x)=>n+x.byteLength,0);if(pad>0)chunks.push(new Uint8Array(pad));offset=aligned
  const imageView=views.length;chunks.push(imageBytes);views.push({buffer:0,byteOffset:offset,byteLength:imageBytes.byteLength})
  const bin=concatBytes(...chunks)
  const accessors=[{bufferView:0,componentType:5126,count:3,type:'VEC3'}]
  const attributes={POSITION:0}
  if(uvView!==undefined){accessors.push({bufferView:uvView,componentType:5126,count:3,type:'VEC2'});attributes[options.texCoord===1?'TEXCOORD_1':'TEXCOORD_0']=accessors.length-1}
  if(colorView!==undefined){accessors.push({bufferView:colorView,componentType:5121,normalized:true,count:3,type:'VEC3'});attributes.COLOR_0=accessors.length-1}
  if(tangentView!==undefined){accessors.push({bufferView:tangentView,componentType:5126,count:3,type:'VEC4'});attributes.TANGENT=accessors.length-1}
  const info={index:0,...(options.texCoord===1?{texCoord:1}:{})}
  const pbr={baseColorFactor:[0.8,0.7,0.6,0.9],metallicFactor:0.5,roughnessFactor:0.7}
  if(options.channels.includes('baseColor'))pbr.baseColorTexture=info
  if(options.channels.includes('metallicRoughness'))pbr.metallicRoughnessTexture=info
  const material={pbrMetallicRoughness:pbr,emissiveFactor:[0.2,0.3,0.4],alphaMode:'MASK',alphaCutoff:0.4,doubleSided:true,...(options.mtoon?{extensions:{VRMC_materials_mtoon:{shadeColorFactor:[0.36,0.28,0.42],shadingShiftFactor:-0.12,shadingToonyFactor:0.84,giEqualizationFactor:0.45,parametricRimColorFactor:[0.9,0.75,1],rimLightingMixFactor:0.72,parametricRimFresnelPowerFactor:3.2,parametricRimLiftFactor:0.08,outlineWidthMode:'worldCoordinates',outlineWidthFactor:0.006,outlineColorFactor:[0.07,0.05,0.09],outlineLightingMixFactor:0.2}}}:{})}
  if(options.channels.includes('normal'))material.normalTexture={...info,scale:0.75}
  if(options.channels.includes('emissive'))material.emissiveTexture=info
  if(options.channels.includes('occlusion'))material.occlusionTexture={...info,strength:0.6}
  const primitive={attributes,material:0}
  const image=options.imageDataUri?{uri:'data:image/png;base64,iVBORw0KGgo='}:{bufferView:imageView,mimeType:'image/png'}
  const document={asset:{version:'2.0'},buffers:[{byteLength:bin.byteLength}],bufferViews:views,accessors,images:[image],samplers:[options.sampler??{}],textures:[{source:0,sampler:0}],materials:[material],meshes:[{primitives:options.duplicatePrimitive?[primitive,{...primitive}]:[primitive]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0}
  return createGlb(document,bin)
}
function makeDocument(options){const info={index:0};const pbr={};if(options.channels.includes('baseColor'))pbr.baseColorTexture=info;const material={pbrMetallicRoughness:pbr};if(options.channels.includes('emissive'))material.emissiveTexture=info;return{asset:{version:'2.0'},buffers:[{uri:options.bufferUri,byteLength:options.bufferLength}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:24}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC2'}],images:[options.image],textures:[{source:0}],materials:[material],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0}}
function createGlb(document,binary){const json=new TextEncoder().encode(JSON.stringify(document));const jl=align4(json.byteLength),bl=align4(binary.byteLength);const out=new Uint8Array(12+8+jl+8+bl);const v=new DataView(out.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.byteLength,true);v.setUint32(12,jl,true);v.setUint32(16,0x4e4f534a,true);out.fill(0x20,20,20+jl);out.set(json,20);const bh=20+jl;v.setUint32(bh,bl,true);v.setUint32(bh+4,0x004e4942,true);out.set(binary,bh+8);return out.buffer}
function floatBytes(values){const f=new Float32Array(values);return new Uint8Array(f.buffer.slice(0))}
function concatBytes(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let o=0;for(const p of parts){out.set(p,o);o+=p.byteLength}return out}
function align4(value){return(value+3)&~3}

function linearToSrgb(value) { return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055 }
