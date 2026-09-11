import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetManager, type AssetLoadOptions, type AssetResolver } from '@sekai64-internal/assets'
import { StandardMaterial, Texture } from '@sekai64-internal/materials'
import { Mesh } from '@sekai64-internal/scene'
import { GLTF_LOADER_CAPABILITIES, GltfLoader, getBufferViewBytes, type GltfDocument } from './GltfLoader.js'

class FakeImageBitmap {
  readonly width = 2
  readonly height = 2
  closed = false
  close(): void { this.closed = true }
}

beforeEach(() => {
  vi.stubGlobal('ImageBitmap', FakeImageBitmap)
  vi.stubGlobal('createImageBitmap', vi.fn(async () => new FakeImageBitmap()))
})
afterEach(() => vi.unstubAllGlobals())

describe('GltfLoader material textures', () => {

  it('reports the implemented loader feature profile', () => {
    expect(GLTF_LOADER_CAPABILITIES.formats).toEqual(['gltf', 'glb', 'vrm'])
    expect(GLTF_LOADER_CAPABILITIES.materialTextures).toEqual(['baseColor', 'normal', 'metallicRoughness', 'emissive', 'occlusion', 'lightMap', 'faceShadow', 'mtoonShade', 'mtoonShadingShift', 'mtoonMatcap', 'mtoonRim'])
    expect(GLTF_LOADER_CAPABILITIES.vertexColors).toBe(true)
    expect(GLTF_LOADER_CAPABILITIES.alphaMask).toBe(true)
    expect(GLTF_LOADER_CAPABILITIES.alphaBlend).toBe(true)
    expect(GLTF_LOADER_CAPABILITIES.doubleSided).toBe(true)
    expect(GLTF_LOADER_CAPABILITIES.legacyVrmMtoon).toBe(true)
  })

  it('loads an embedded GLB base-color texture with glTF sampler semantics', async () => {
    const fixture = makeGlbFixture({ channels: ['baseColor'], sampler: { magFilter: 9728, minFilter: 9986, wrapS: 33071, wrapT: 33648 } })
    const loader = loaderFor({ 'https://test.local/model.glb': new Response(fixture, { status: 200 }) })
    const asset = await loader.load('https://test.local/model.glb')
    const mesh = asset.scene.findByTag('gltf-mesh')[0] as Mesh
    const material = mesh.material as StandardMaterial
    const texture = material.baseColorTexture as Texture

    expect(texture.ready).toBe(true)
    expect(texture.flipY).toBe(false)
    expect(texture.colorSpace).toBe('srgb')
    expect(texture.magFilter).toBe('nearest')
    expect(texture.minFilter).toBe('nearest-mipmap-linear')
    expect(texture.wrapS).toBe('clamp-to-edge')
    expect(texture.wrapT).toBe('mirror-repeat')
    expect(texture.generateMipmaps).toBe(true)

    asset.dispose()
    expect(texture.disposed).toBe(true)
    loader.dispose()
  })

  it('loads all core material texture channels with correct color spaces and shared caching', async () => {
    const fixture = makeGlbFixture({ channels: ['baseColor', 'normal', 'metallicRoughness', 'emissive', 'occlusion'], duplicatePrimitive: true })
    const loader = loaderFor({ 'https://test.local/all.glb': new Response(fixture, { status: 200 }) })
    const asset = await loader.load('https://test.local/all.glb')
    const meshes = asset.scene.findByTag('gltf-mesh') as Mesh[]
    const first = meshes[0]?.material as StandardMaterial
    const second = meshes[1]?.material as StandardMaterial

    expect(first.baseColorTexture?.colorSpace).toBe('srgb')
    expect(first.emissiveTexture?.colorSpace).toBe('srgb')
    expect(first.normalTexture?.colorSpace).toBe('linear')
    expect(first.metallicRoughnessTexture?.colorSpace).toBe('linear')
    expect(first.occlusionTexture?.colorSpace).toBe('linear')
    expect(first.baseColorTexture).toBe(first.emissiveTexture)
    expect(first.normalTexture).toBe(first.metallicRoughnessTexture)
    expect(first.normalTexture).toBe(first.occlusionTexture)
    expect(second.baseColorTexture).toBe(first.baseColorTexture)
    expect(first.normalScale).toBe(0.75)
    expect(first.occlusionStrength).toBe(0.6)
    expect(first.alphaMode).toBe('mask')
    expect(first.alphaCutoff).toBe(0.4)
    expect(first.doubleSided).toBe(true)

    asset.dispose()
    loader.dispose()
  })

  it('loads an external glTF image relative to the document and fetches it once', async () => {
    const positions = floatBytes([0, 0, 0, 1, 0, 0, 0, 1, 0])
    const uvs = floatBytes([0, 0, 1, 0, 0, 1])
    const binary = concatBytes(positions, uvs)
    const document = makeDocument({
      bufferUri: 'mesh.bin',
      bufferLength: binary.byteLength,
      image: { uri: 'textures/base.webp' },
      channels: ['baseColor', 'emissive']
    })
    const calls: string[] = []
    const assets = new AssetManager()
    assets.addResolver({
      canResolve: url => url.hostname === 'test.local',
      async fetch(url): Promise<Response> {
        calls.push(url.href)
        if (url.pathname.endsWith('/model.gltf')) return jsonResponse(document)
        if (url.pathname.endsWith('/mesh.bin')) return new Response(binary, { status: 200 })
        if (url.pathname.endsWith('/textures/base.webp')) return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }), { status: 200, headers: { 'content-type': 'image/webp' } })
        return new Response(null, { status: 404 })
      }
    })
    const loader = new GltfLoader(assets)
    const asset = await loader.load('https://test.local/models/model.gltf')
    const material = (asset.scene.findByTag('gltf-mesh')[0] as Mesh).material as StandardMaterial

    expect(material.baseColorTexture).toBe(material.emissiveTexture)
    expect(calls.filter(value => value.endsWith('/textures/base.webp'))).toHaveLength(1)

    asset.dispose()
    loader.dispose()
    assets.dispose()
  })

  it('supports data URI images, TEXCOORD_1, tangents, and normalized vertex colors', async () => {
    const fixture = makeGlbFixture({ channels: ['baseColor'], imageDataUri: true, texCoord: 1, includeColors: true, includeTangents: true })
    const loader = loaderFor({ 'https://test.local/data.glb': new Response(fixture, { status: 200 }) })
    const asset = await loader.load('https://test.local/data.glb')
    const mesh = asset.scene.findByTag('gltf-mesh')[0] as Mesh
    const material = mesh.material as StandardMaterial

    expect(material.baseColorTexCoord).toBe(1)
    expect(mesh.geometry.uvs1).toBeInstanceOf(Float32Array)
    expect(mesh.geometry.tangents).toBeInstanceOf(Float32Array)
    expect(Array.from(mesh.geometry.colors ?? [])).toEqual([
      1, 0, 0, 1,
      0, 1, 0, 1,
      0, 0, 1, 1
    ])

    asset.dispose()
    loader.dispose()
  })

  it('rejects missing UV sets and malformed embedded image ranges with stable diagnostics', async () => {
    const missingUv = makeGlbFixture({ channels: ['baseColor'], omitUvs: true })
    const loaderA = loaderFor({ 'https://test.local/missing-uv.glb': new Response(missingUv, { status: 200 }) })
    await expect(loaderA.load('https://test.local/missing-uv.glb')).rejects.toThrow(/SEKAI_GLTF_UV_SET_MISSING/)
    loaderA.dispose()

    const document: GltfDocument = { asset: { version: '2.0' }, bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 8 }] }
    expect(() => getBufferViewBytes(document, [new ArrayBuffer(4)], 0)).toThrow(/SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID/)
  })


  it('closes a decoded image that completes after cancellation', async () => {
    let resolveBitmap: ((bitmap: FakeImageBitmap) => void) | undefined
    let resolveStarted: (() => void) | undefined
    const started = new Promise<void>(resolve => { resolveStarted = resolve })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      resolveStarted?.()
      return new Promise<FakeImageBitmap>(resolve => { resolveBitmap = resolve })
    }))
    const fixture = makeGlbFixture({ channels: ['baseColor'] })
    const loader = loaderFor({ 'https://test.local/abort.glb': new Response(fixture, { status: 200 }) })
    const controller = new AbortController()
    const pending = loader.load('https://test.local/abort.glb', { signal: controller.signal })
    await started
    controller.abort(new DOMException('Stopped by test.', 'AbortError'))
    const bitmap = new FakeImageBitmap()
    resolveBitmap?.(bitmap)
    await expect(pending).rejects.toThrow(/Abort|aborted|Stopped by test/)
    expect(bitmap.closed).toBe(true)
    loader.dispose()
  })

  it('releases partially created textures after a decode failure', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image') }))
    const fixture = makeGlbFixture({ channels: ['baseColor'] })
    const loader = loaderFor({ 'https://test.local/bad.glb': new Response(fixture, { status: 200 }) })
    await expect(loader.load('https://test.local/bad.glb')).rejects.toThrow(/SEKAI_GLTF_TEXTURE_DECODE_FAILED/)
    expect(close).not.toHaveBeenCalled()
    loader.dispose()
  })
  it('treats .vrm files as binary glTF containers', async () => {
    const document = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }
    const json = new TextEncoder().encode(JSON.stringify(document))
    const paddedJsonLength = Math.ceil(json.byteLength / 4) * 4
    const totalLength = 12 + 8 + paddedJsonLength
    const bytes = new Uint8Array(totalLength)
    const view = new DataView(bytes.buffer)
    view.setUint32(0, 0x46546c67, true)
    view.setUint32(4, 2, true)
    view.setUint32(8, totalLength, true)
    view.setUint32(12, paddedJsonLength, true)
    view.setUint32(16, 0x4e4f534a, true)
    bytes.set(json, 20)
    bytes.fill(0x20, 20 + json.byteLength, 20 + paddedJsonLength)

    const loader = loaderFor({
      'https://example.test/avatar.vrm': new Response(bytes, { status: 200 }),
    })
    const asset = await loader.load('https://example.test/avatar.vrm')
    expect(asset.document.asset.version).toBe('2.0')
    asset.dispose()
    loader.dispose()
  })

})

function loaderFor(responses: Record<string, Response>): GltfLoader {
  const assets = new AssetManager()
  const resolver: AssetResolver = {
    canResolve: url => url.href in responses,
    async fetch(url: URL, _options: AssetLoadOptions): Promise<Response> {
      const response = responses[url.href]
      if (!response) return new Response(null, { status: 404 })
      return response.clone()
    }
  }
  assets.addResolver(resolver)
  const loader = new GltfLoader(assets)
  const originalDispose = loader.dispose.bind(loader)
  loader.dispose = (): void => { originalDispose(); assets.dispose() }
  return loader
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

type Channel = 'baseColor' | 'normal' | 'metallicRoughness' | 'emissive' | 'occlusion'
interface FixtureOptions {
  channels: Channel[]
  sampler?: Record<string, number>
  duplicatePrimitive?: boolean
  imageDataUri?: boolean
  texCoord?: 0 | 1
  includeColors?: boolean
  includeTangents?: boolean
  omitUvs?: boolean
}

function makeGlbFixture(options: FixtureOptions): ArrayBuffer {
  const positionBytes = floatBytes([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const uvBytes = floatBytes([0, 0, 1, 0, 0, 1])
  const colorBytes = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
  const tangentBytes = floatBytes([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1])
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks: Uint8Array[] = [positionBytes]
  const views: Array<{ buffer: number; byteOffset: number; byteLength: number }> = []
  let offset = 0
  views.push({ buffer: 0, byteOffset: offset, byteLength: positionBytes.byteLength }); offset += positionBytes.byteLength
  let uvView: number | undefined
  if (!options.omitUvs) { uvView = views.length; chunks.push(uvBytes); views.push({ buffer: 0, byteOffset: offset, byteLength: uvBytes.byteLength }); offset += uvBytes.byteLength }
  let colorView: number | undefined
  if (options.includeColors) { colorView = views.length; chunks.push(colorBytes); views.push({ buffer: 0, byteOffset: offset, byteLength: colorBytes.byteLength }); offset += colorBytes.byteLength }
  let tangentView: number | undefined
  if (options.includeTangents) { offset = align4(offset); const pad = offset - chunks.reduce((n, item) => n + item.byteLength, 0); if (pad > 0) chunks.push(new Uint8Array(pad)); tangentView = views.length; chunks.push(tangentBytes); views.push({ buffer: 0, byteOffset: offset, byteLength: tangentBytes.byteLength }); offset += tangentBytes.byteLength }
  offset = align4(offset)
  const current = chunks.reduce((n, item) => n + item.byteLength, 0)
  if (offset > current) chunks.push(new Uint8Array(offset - current))
  const imageView = views.length
  chunks.push(imageBytes)
  views.push({ buffer: 0, byteOffset: offset, byteLength: imageBytes.byteLength })
  offset += imageBytes.byteLength
  const binary = concatBytes(...chunks)

  const accessors: unknown[] = [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }]
  const attributes: Record<string, number> = { POSITION: 0 }
  if (uvView !== undefined) { accessors.push({ bufferView: uvView, componentType: 5126, count: 3, type: 'VEC2' }); attributes[options.texCoord === 1 ? 'TEXCOORD_1' : 'TEXCOORD_0'] = accessors.length - 1 }
  if (colorView !== undefined) { accessors.push({ bufferView: colorView, componentType: 5121, normalized: true, count: 3, type: 'VEC3' }); attributes.COLOR_0 = accessors.length - 1 }
  if (tangentView !== undefined) { accessors.push({ bufferView: tangentView, componentType: 5126, count: 3, type: 'VEC4' }); attributes.TANGENT = accessors.length - 1 }
  const textureInfo = { index: 0, ...(options.texCoord === 1 ? { texCoord: 1 } : {}) }
  const pbr: Record<string, unknown> = { baseColorFactor: [0.8, 0.7, 0.6, 0.9], metallicFactor: 0.5, roughnessFactor: 0.7 }
  if (options.channels.includes('baseColor')) pbr.baseColorTexture = textureInfo
  if (options.channels.includes('metallicRoughness')) pbr.metallicRoughnessTexture = textureInfo
  const material: Record<string, unknown> = { pbrMetallicRoughness: pbr, emissiveFactor: [0.2, 0.3, 0.4], alphaMode: 'MASK', alphaCutoff: 0.4, doubleSided: true }
  if (options.channels.includes('normal')) material.normalTexture = { ...textureInfo, scale: 0.75 }
  if (options.channels.includes('emissive')) material.emissiveTexture = textureInfo
  if (options.channels.includes('occlusion')) material.occlusionTexture = { ...textureInfo, strength: 0.6 }
  const primitive = { attributes, material: 0 }
  const image = options.imageDataUri
    ? { uri: 'data:image/png;base64,iVBORw0KGgo=' }
    : { bufferView: imageView, mimeType: 'image/png' }
  const document = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: views,
    accessors,
    images: [image],
    samplers: [options.sampler ?? {}],
    textures: [{ source: 0, sampler: 0 }],
    materials: [material],
    meshes: [{ primitives: options.duplicatePrimitive ? [primitive, { ...primitive }] : [primitive] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  }
  return createGlb(document, binary)
}

function makeDocument(options: { bufferUri: string; bufferLength: number; image: Record<string, unknown>; channels: Channel[] }): Record<string, unknown> {
  const textureInfo = { index: 0 }
  const pbr: Record<string, unknown> = {}
  if (options.channels.includes('baseColor')) pbr.baseColorTexture = textureInfo
  const material: Record<string, unknown> = { pbrMetallicRoughness: pbr }
  if (options.channels.includes('emissive')) material.emissiveTexture = textureInfo
  return {
    asset: { version: '2.0' },
    buffers: [{ uri: options.bufferUri, byteLength: options.bufferLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
    images: [options.image], textures: [{ source: 0 }], materials: [material],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0
  }
}

function createGlb(document: unknown, binary: Uint8Array): ArrayBuffer {
  const encoder = new TextEncoder()
  const json = encoder.encode(JSON.stringify(document))
  const jsonLength = align4(json.byteLength)
  const binaryLength = align4(binary.byteLength)
  const output = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength)
  const view = new DataView(output.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, output.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  output.fill(0x20, 20, 20 + jsonLength)
  output.set(json, 20)
  const binaryHeader = 20 + jsonLength
  view.setUint32(binaryHeader, binaryLength, true)
  view.setUint32(binaryHeader + 4, 0x004e4942, true)
  output.set(binary, binaryHeader + 8)
  return output.buffer
}

function floatBytes(values: number[]): Uint8Array {
  const floats = new Float32Array(values)
  return new Uint8Array(floats.buffer.slice(0))
}
function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.byteLength }
  return output
}
function align4(value: number): number { return (value + 3) & ~3 }
