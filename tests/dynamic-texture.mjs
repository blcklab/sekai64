import assert from 'node:assert/strict'
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'
import { createRendererFeatures } from '@blcklab/sekai64/renderer'

const previousImageData = globalThis.ImageData
class FakeImageData {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}
globalThis.ImageData = FakeImageData

try {
  const diagnostics = []
  const renderer = {
    backend: 'webgl2',
    disposed: false,
    capabilities: {
      backend: 'webgl2',
      maxTextureSize: 4096,
      maxPointLights: 8,
      computeShaders: false,
      timestampQueries: false,
      instancing: true,
      offscreenCanvas: false,
      features: createRendererFeatures(),
    },
  }
  const capability = createDynamicTextureCapability(renderer, {
    diagnostics: diagnostic => diagnostics.push(diagnostic),
  })
  assert.equal(capability.backend, 'webgl2')
  assert.equal(capability.maxTextureSize, 4096)

  const frame = capability.create({ width: 160, height: 144, label: 'gameboy-frame' })
  assert.equal(frame.width, 160)
  assert.equal(frame.height, 144)
  const initialVersion = frame.version
  for (let index = 0; index < 20; index += 1) frame.update(new FakeImageData(160, 144))
  assert.equal(frame.version, initialVersion + 20)
  assert.equal(frame.texture.image.width, 160)
  frame.resize(320, 288)
  assert.equal(frame.width, 320)
  assert.equal(frame.height, 288)
  frame.dispose()
  assert.equal(frame.disposed, true)
  assert.throws(() => frame.resize(1, 1), /disposed/)

  const limited = createDynamicTextureCapability({ ...renderer, capabilities: { ...renderer.capabilities, maxTextureSize: 64 } }, {
    diagnostics: diagnostic => diagnostics.push(diagnostic),
  })
  assert.throws(() => limited.create({ width: 65, height: 64 }), /exceed/)
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'SEKAI64_DYNAMIC_TEXTURE_SIZE_LIMIT'))

  const webgpuDiagnostics = []
  const webgpu = createDynamicTextureCapability({
    ...renderer,
    backend: 'webgpu',
    capabilities: { ...renderer.capabilities, backend: 'webgpu', computeShaders: true },
  }, { diagnostics: diagnostic => webgpuDiagnostics.push(diagnostic) })
  const gpuFrame = webgpu.create({ width: 16, height: 16, mipmaps: 'generate' })
  assert.equal(gpuFrame.texture.generateMipmaps, true)
  assert.equal(webgpuDiagnostics.some(diagnostic => diagnostic.code === 'SEKAI64_DYNAMIC_TEXTURE_WEBGPU_MIPMAP_DOWNGRADE'), false)
  gpuFrame.dispose()

  console.log('Sekai64 dynamic texture smoke tests passed.')
} finally {
  if (previousImageData === undefined) delete globalThis.ImageData
  else globalThis.ImageData = previousImageData
}
