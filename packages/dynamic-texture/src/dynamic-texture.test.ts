import { afterEach, describe, expect, it } from 'vitest'
import { createRendererAdvancedCapabilities, createRendererFeatures } from '@sekai64-internal/renderer'
import { createDynamicTextureCapability } from './DynamicTexture.js'

class FakeImageData {
  readonly data: Uint8ClampedArray
  constructor(readonly width: number, readonly height: number) {
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

const previousImageData = globalThis.ImageData

afterEach(() => {
  if (previousImageData === undefined) delete (globalThis as { ImageData?: typeof ImageData }).ImageData
  else globalThis.ImageData = previousImageData
})

function renderer(backend: 'webgl2' | 'webgpu', maxTextureSize = 4096) {
  return {
    backend,
    disposed: false,
    capabilities: {
      backend,
      maxTextureSize,
      maxPointLights: 8,
      maxSpotLights: 4,
      computeShaders: backend === 'webgpu',
      timestampQueries: false,
      instancing: true,
      offscreenCanvas: false,
      features: createRendererFeatures(),
      advanced: createRendererAdvancedCapabilities(),
    },
  }
}

describe('dynamic texture capability', () => {
  it('creates, updates, resizes, and disposes a renderer-neutral texture', () => {
    globalThis.ImageData = FakeImageData as unknown as typeof ImageData
    const capability = createDynamicTextureCapability(renderer('webgl2'))
    const dynamic = capability.create({ width: 160, height: 144, label: 'game-frame' })
    expect(dynamic.width).toBe(160)
    expect(dynamic.height).toBe(144)
    const initialVersion = dynamic.version
    dynamic.update(new FakeImageData(320, 288) as unknown as ImageData)
    expect(dynamic.version).toBe(initialVersion + 1)
    expect(dynamic.width).toBe(320)
    dynamic.resize(80, 72)
    expect(dynamic.width).toBe(80)
    expect(dynamic.height).toBe(72)
    dynamic.dispose()
    expect(dynamic.disposed).toBe(true)
    expect(() => dynamic.update(new FakeImageData(1, 1) as unknown as ImageData)).toThrow('disposed')
  })

  it('coalesces repeated CPU updates into the latest texture version', () => {
    globalThis.ImageData = FakeImageData as unknown as typeof ImageData
    const dynamic = createDynamicTextureCapability(renderer('webgl2')).create({ width: 2, height: 2 })
    const initialVersion = dynamic.version
    for (let index = 0; index < 100; index += 1) dynamic.update(new FakeImageData(2, 2) as unknown as ImageData)
    expect(dynamic.version).toBe(initialVersion + 100)
    expect(dynamic.texture.image).toBeInstanceOf(FakeImageData)
  })

  it('enforces renderer and configured dimension limits with diagnostics', () => {
    globalThis.ImageData = FakeImageData as unknown as typeof ImageData
    const diagnostics: string[] = []
    const capability = createDynamicTextureCapability(renderer('webgl2', 256), {
      diagnostics: diagnostic => diagnostics.push(diagnostic.code),
    })
    expect(capability.maxTextureSize).toBe(256)
    expect(() => capability.create({ width: 512, height: 32 })).toThrow('exceed')
    expect(diagnostics).toContain('SEKAI64_DYNAMIC_TEXTURE_SIZE_LIMIT')
  })

  it('preserves generated mipmaps for WebGPU dynamic textures', () => {
    globalThis.ImageData = FakeImageData as unknown as typeof ImageData
    const diagnostics: string[] = []
    const dynamic = createDynamicTextureCapability(renderer('webgpu'), {
      diagnostics: diagnostic => diagnostics.push(diagnostic.code),
    }).create({ width: 16, height: 16, mipmaps: 'generate' })
    expect(dynamic.texture.generateMipmaps).toBe(true)
    expect(diagnostics).not.toContain('SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE')
  })
})
