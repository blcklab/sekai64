import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PerspectiveCamera } from '@blcklab/sekai64/cameras'
import { Geometry } from '@blcklab/sekai64/geometry'
import { ShaderMaterial, StandardMaterial, Texture } from '@blcklab/sekai64/materials'
import { Mesh, Scene } from '@blcklab/sekai64/scene'
import { WebGL2Renderer } from '@blcklab/sekai64/renderers/webgl2'
import { WebGPURenderer } from '@blcklab/sekai64/renderers/webgpu'

class FakeImageBitmap {
  closed = false
  constructor(width = 2, height = 2) { this.width = width; this.height = height }
  close() { this.closed = true }
}
globalThis.ImageBitmap = FakeImageBitmap

const geometry = new Geometry({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
  uvs1: new Float32Array([0, 1, 1, 1, 0.5, 0]),
  colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]),
  tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1])
}, 'textured-triangle')

function texture(label, colorSpace, generateMipmaps = false, minFilter = generateMipmaps ? 'linear-mipmap-linear' : 'linear') {
  return new Texture({ source: new FakeImageBitmap(), label, colorSpace, flipY: false, generateMipmaps, minFilter, wrapS: 'repeat', wrapT: 'mirror-repeat' })
}
const textures = [
  texture('base', 'srgb', true),
  texture('metallic-roughness', 'linear'),
  texture('normal', 'linear'),
  texture('emissive', 'srgb'),
  texture('occlusion', 'linear', false, 'linear-mipmap-nearest'),
  texture('detail-normal', 'linear', true),
  texture('detail-roughness', 'linear', true)
]
const material = new StandardMaterial({
  baseColor: [0.8, 0.7, 0.6, 0.75],
  baseColorTexture: textures[0],
  baseColorTexCoord: 1,
  metallic: 0.5,
  roughness: 0.65,
  metallicRoughnessTexture: textures[1],
  normalTexture: textures[2],
  normalScale: 0.8,
  emissive: [0.1, 0.2, 0.3],
  emissiveTexture: textures[3],
  occlusionTexture: textures[4],
  occlusionStrength: 0.7,
  detail: { normalTexture: textures[5], roughnessTexture: textures[6], scale: 12, strength: 0.35, roughnessStrength: 0.4 },
  alphaMode: 'blend',
  doubleSided: true,
  ownsTextures: true
})
const mesh = new Mesh({ id: 'textured', geometry, material, ownsResources: true })
const scene = new Scene().add(mesh)
const camera = new PerspectiveCamera({ aspect: 1 })
camera.position.z = 4

const shaderMaterial = new ShaderMaterial({
  label: 'smoke-shader',
  transparent: true,
  side: 'double',
  depthWrite: false,
  uniforms: { time: 1, tint: [0.2, 0.8, 1, 0.5] },
  glsl: {
    vertex: `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform mat4 u_model;
uniform mat4 u_viewProjection;
out vec3 v_normal;
void main(){v_normal=mat3(u_model)*a_normal;gl_Position=u_viewProjection*u_model*vec4(a_position,1.0);}`,
    fragment: `#version 300 es
precision highp float;
in vec3 v_normal;
uniform vec3 u_cameraPosition;
uniform vec4 u_viewport;
uniform vec4 u_custom[16];
out vec4 outColor;
void main(){outColor=vec4(u_custom[1].rgb*(0.5+0.5*abs(normalize(v_normal).z)),u_custom[1].a);}`,
  },
  wgsl: {
    vertex: `struct Sekai64ShaderUniforms { model:mat4x4<f32>, viewProjection:mat4x4<f32>, cameraPosition:vec4<f32>, viewport:vec4<f32>, custom:array<vec4<f32>,16> }
@group(0) @binding(0) var<uniform> sekai64:Sekai64ShaderUniforms;
struct VertexOutput { @builtin(position) position:vec4<f32>, @location(0) normal:vec3<f32> }
@vertex fn vertex_main(@location(0) position:vec3<f32>,@location(1) normal:vec3<f32>)->VertexOutput{var output:VertexOutput;output.position=sekai64.viewProjection*sekai64.model*vec4<f32>(position,1.0);output.normal=(sekai64.model*vec4<f32>(normal,0.0)).xyz;return output;}`,
    fragment: `@fragment fn fragment_main(@location(0) normal:vec3<f32>)->@location(0) vec4<f32>{return vec4<f32>(sekai64.custom[1].rgb*(0.5+0.5*abs(normalize(normal).z)),sekai64.custom[1].a);}`,
  },
})
const shaderMesh = new Mesh({ id: 'shader', geometry, material: shaderMaterial })
const shaderScene = new Scene().add(shaderMesh)

const previousHtmlCanvas = globalThis.HTMLCanvasElement
class FakeHtmlCanvas {
  constructor(context) { this.width = 1; this.height = 1; this.context = context; this.listeners = new Map() }
  getContext(type) { return type === 'webgl2' ? this.context : null }
  addEventListener(type, listener) { this.listeners.set(type, listener) }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type) }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event) }
}
globalThis.HTMLCanvasElement = FakeHtmlCanvas
const glState = { shaderSources: [], textureUploads: 0, textureSubUploads: 0, createdTextures: 0, mipmaps: 0, draws: 0, deletedTextures: 0, diagnostics: [] }
const gl = createFakeWebGL2(glState)
const glCanvas = new FakeHtmlCanvas(gl)
const webgl = new WebGL2Renderer()
await webgl.initialize({ canvas: glCanvas, antialias: false, diagnostics: diagnostic => glState.diagnostics.push(diagnostic) })
webgl.resize(320, 240, 1)
webgl.render(scene, camera)
assert.ok(glState.shaderSources.some(source => source.includes('u_metallicRoughnessMap')))
assert.ok(glState.shaderSources.some(source => source.includes('u_normalMap')))
assert.ok(glState.shaderSources.some(source => source.includes('u_forceOpaqueAlpha')))
assert.ok(glState.shaderSources.some(source => source.includes('u_detailNormalMap')))
assert.ok(glState.shaderSources.some(source => source.includes('u_detailRoughnessMap')))
assert.ok(glState.shaderSources.some(source => source.includes('u_detailParams')))
assert.ok(glState.textureUploads >= 6, `expected fallback plus five texture uploads, received ${glState.textureUploads}`)
assert.ok(glState.mipmaps >= 1)
assert.equal(glState.draws, 1)
assert.equal(webgl.stats.drawCalls, 1)
webgl.render(shaderScene, camera)
assert.ok(glState.shaderSources.some(source => source.includes('u_custom[16]')))
assert.equal(glState.draws, 2)
assert.equal(webgl.stats.drawCalls, 1)
const glCreatedAfterFirstRender = glState.createdTextures
const glSubUploadsBeforeUpdate = glState.textureSubUploads
textures[0].setImage(new FakeImageBitmap())
webgl.render(scene, camera)
assert.equal(glState.createdTextures, glCreatedAfterFirstRender, 'same-size WebGL2 updates must reuse texture storage')
assert.equal(glState.textureSubUploads, glSubUploadsBeforeUpdate + 1)
const glSubUploadsBeforeCoalescedRender = glState.textureSubUploads
for (let index = 0; index < 20; index += 1) textures[0].setImage(new FakeImageBitmap())
webgl.render(scene, camera)
assert.equal(glState.textureSubUploads, glSubUploadsBeforeCoalescedRender + 1, 'many CPU updates before one render must coalesce to one GPU upload')
let contextLossPrevented = false
glCanvas.dispatch('webglcontextlost', { preventDefault() { contextLossPrevented = true } })
assert.equal(contextLossPrevented, true)
assert.ok(glState.diagnostics.some(item => item.code === 'SEKAI64_WEBGL_CONTEXT_LOST'))
glCanvas.dispatch('webglcontextrestored')
assert.ok(glState.diagnostics.some(item => item.code === 'SEKAI64_WEBGL_CONTEXT_RESTORED'))
const uploadsBeforeRestoreRender = glState.textureUploads
webgl.render(scene, camera)
assert.ok(glState.textureUploads >= uploadsBeforeRestoreRender + 5, 'restored WebGL2 contexts must rebuild retained texture sources')
webgl.dispose()
restoreGlobal('HTMLCanvasElement', previousHtmlCanvas)
assert.ok(glState.deletedTextures >= 1)

const previousNavigator = globalThis.navigator
const previousShaderStage = globalThis.GPUShaderStage
const previousBufferUsage = globalThis.GPUBufferUsage
const previousTextureUsage = globalThis.GPUTextureUsage
const gpuState = { shaderSources: [], textureCopies: 0, createdTextures: 0, bindEntries: [], draws: 0, destroyedTextures: 0, diagnostics: [], samplers: [] }
globalThis.GPUShaderStage = { VERTEX: 1, FRAGMENT: 2 }
globalThis.GPUBufferUsage = { VERTEX: 1, INDEX: 2, UNIFORM: 4, COPY_DST: 8 }
globalThis.GPUTextureUsage = { TEXTURE_BINDING: 1, COPY_DST: 2, RENDER_ATTACHMENT: 4 }
const fakeGpu = createFakeWebGPU(gpuState)
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: fakeGpu.gpu } })
const gpuCanvas = { width: 1, height: 1, getContext: type => type === 'webgpu' ? fakeGpu.context : null }
const webgpu = new WebGPURenderer()
await webgpu.initialize({ canvas: gpuCanvas, antialias: false, diagnostics: diagnostic => gpuState.diagnostics.push(diagnostic) })
webgpu.resize(320, 240, 1)
webgpu.render(scene, camera)
assert.ok(gpuState.shaderSources.some(source => source.includes('metallicRoughnessTexture')))
assert.ok(gpuState.shaderSources.some(source => source.includes('normalTexture')))
assert.ok(gpuState.shaderSources.some(source => source.includes('uniforms.materialParams2.w')))
assert.ok(gpuState.shaderSources.some(source => source.includes('detailNormalTexture')))
assert.ok(gpuState.shaderSources.some(source => source.includes('detailRoughnessTexture')))
assert.ok(gpuState.shaderSources.some(source => source.includes('uniforms.detailParams')))
const standardWgsl = gpuState.shaderSources.find(source => source.includes('fn surfaceNormal'))
assert.ok(standardWgsl, 'expected the standard WGSL shader source')
assert.equal(standardWgsl.trimEnd().endsWith('}\n}'), false, 'standard WGSL must not end with a stray top-level brace')
const derivativeIndex = standardWgsl.indexOf('let dp1=dpdx(input.worldPosition);')
const tangentBranchIndex = standardWgsl.indexOf('if(length(input.tangent.xyz)>0.0001)')
assert.ok(derivativeIndex >= 0, 'expected derivative-based tangent reconstruction')
assert.ok(tangentBranchIndex >= 0, 'expected tangent availability branch')
assert.ok(derivativeIndex < tangentBranchIndex, 'WGSL derivatives must execute before non-uniform tangent control flow')
assert.ok(standardWgsl.includes('textureSampleCompareLevel(shadowTexture,shadowSampler'), 'shadow sampling must use explicit-level compare sampling')
assert.ok(!standardWgsl.includes('textureSampleCompare(shadowTexture,shadowSampler'), 'implicit-derivative shadow compare sampling is invalid in non-uniform fragment control flow')
assert.ok(standardWgsl.includes('faceShadowTexture'), 'MToon face-shadow sampling must be present')
assert.ok(standardWgsl.includes('environmentTexture'), 'environment-map IBL must be present')
assert.ok(standardWgsl.includes('environmentDiffuseTexture'), 'diffuse irradiance IBL must be present')
assert.ok(standardWgsl.includes('environmentBrdfTexture'), 'split-sum BRDF LUT support must be present')
assert.ok(standardWgsl.includes('cofactor0=cross'), 'non-uniform scale normals must use an inverse-transpose equivalent')
assert.ok(standardWgsl.includes('outline_vertex'), 'inverted-hull outline stage must be present')
const standardGlsl = glState.shaderSources.find(source => source.includes('vec3 surfaceNormal'))
assert.ok(standardGlsl, 'expected the standard GLSL shader source')
assert.match(standardGlsl, /precision highp sampler2D;/, 'standard GLSL must explicitly qualify sampler2D precision')
assert.match(standardGlsl, /precision highp sampler2DArray;/, 'standard GLSL must explicitly qualify sampler2DArray precision')
assert.ok(standardGlsl.indexOf('vec3 dp1=dFdx(v_worldPosition);') < standardGlsl.indexOf('if(length(v_tangent.xyz)>0.0001)'), 'GLSL derivatives must execute before tangent control flow')
assert.ok(standardGlsl.includes('u_environmentDiffuseMap'), 'GLSL diffuse irradiance IBL must be present')
assert.ok(standardGlsl.includes('u_environmentBrdfLut'), 'GLSL split-sum BRDF LUT support must be present')
assert.ok(glState.shaderSources.some(source => source.includes('transpose(inverse(model3))')), 'GLSL normals must use inverse-transpose for non-uniform scale')
assert.ok(gpuState.textureCopies >= 5)
assert.ok(gpuState.bindEntries.some(count => count >= 31), 'standard WebGPU materials must bind IBL and material-detail resources')
assert.ok(gpuState.samplers.some(descriptor => descriptor.mipmapFilter === 'nearest' && descriptor.maxAnisotropy === 1), 'nearest-mipmap glTF samplers must disable WebGPU anisotropy instead of creating an invalid sampler')
for (const descriptor of gpuState.samplers) {
  if ((descriptor.maxAnisotropy ?? 1) <= 1) continue
  assert.equal(descriptor.minFilter, 'linear', 'anisotropic WebGPU samplers require linear minFilter')
  assert.equal(descriptor.magFilter, 'linear', 'anisotropic WebGPU samplers require linear magFilter')
  assert.equal(descriptor.mipmapFilter, 'linear', 'anisotropic WebGPU samplers require linear mipmapFilter')
}
assert.equal(gpuState.draws, 4, 'three mipmap passes plus one scene draw are expected')
assert.equal(webgpu.stats.drawCalls, 1)
webgpu.render(shaderScene, camera)
assert.ok(gpuState.shaderSources.some(source => source.includes('Sekai64ShaderUniforms')))
assert.ok(gpuState.bindEntries.some(count => count === 1), 'ShaderMaterial should use the compact one-buffer bind group')
assert.equal(gpuState.draws, 5)
assert.equal(webgpu.stats.drawCalls, 1)
assert.equal(webgpu.capabilities.features.mipmapGeneration, true)
const gpuCreatedAfterFirstRender = gpuState.createdTextures
const gpuCopiesBeforeUpdate = gpuState.textureCopies
textures[0].setImage(new FakeImageBitmap())
webgpu.render(scene, camera)
assert.equal(gpuState.createdTextures, gpuCreatedAfterFirstRender, 'same-size WebGPU updates must reuse texture storage')
assert.equal(gpuState.textureCopies, gpuCopiesBeforeUpdate + 1)
const gpuCopiesBeforeCoalescedRender = gpuState.textureCopies
for (let index = 0; index < 20; index += 1) textures[0].setImage(new FakeImageBitmap())
webgpu.render(scene, camera)
assert.equal(gpuState.createdTextures, gpuCreatedAfterFirstRender)
assert.equal(gpuState.textureCopies, gpuCopiesBeforeCoalescedRender + 1, 'many CPU updates before one render must coalesce to one GPU upload')
const destroyedBeforeResize = gpuState.destroyedTextures
textures[0].setImage(new FakeImageBitmap(4, 4))
webgpu.render(scene, camera)
assert.equal(gpuState.createdTextures, gpuCreatedAfterFirstRender + 1, 'resized WebGPU textures must allocate new storage')
assert.equal(gpuState.destroyedTextures, destroyedBeforeResize + 1)
fakeGpu.loseDevice({ reason: 'destroyed', message: 'Simulated device loss.' })
await Promise.resolve()
await Promise.resolve()
assert.ok(gpuState.diagnostics.some(item => item.code === 'SEKAI64_WEBGPU_DEVICE_LOST'))
webgpu.dispose()
assert.ok(gpuState.destroyedTextures >= 6)

scene.dispose()
shaderScene.dispose()
shaderMaterial.dispose()
assert.ok(textures.every(value => value.disposed))

restoreGlobal('navigator', previousNavigator)
restoreGlobal('GPUShaderStage', previousShaderStage)
restoreGlobal('GPUBufferUsage', previousBufferUsage)
restoreGlobal('GPUTextureUsage', previousTextureUsage)
const webgpuSource = readFileSync(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
const postProcessWgslSource = readFileSync(new URL('../packages/renderer-webgpu/src/WebGPUPostProcessPipeline.ts', import.meta.url), 'utf8')
assert.equal(/\btextureSample\(/.test(postProcessWgslSource), false, 'WebGPU post-process WGSL must use explicit-LOD sampling')
assert.match(postProcessWgslSource, /textureSampleLevel\(inputTexture,linearSampler/)
assert.match(postProcessWgslSource, /output\.uv=vec2<f32>\(p\.x\*0\.5\+0\.5,0\.5-p\.y\*0\.5\)/, 'post-process fullscreen UVs must preserve WebGPU render-target orientation')
assert.match(webgpuSource, /output\.uv=positions\[index\]\*vec2<f32>\(0\.5,-0\.5\)\+vec2<f32>\(0\.5\)/, 'mipmap fullscreen UVs must preserve texture orientation')
assert.match(webgpuSource, /const adapterOptions = \/windows\|win32\/i\.test\(platform\)/)

console.log('Sekai64 material renderer smoke tests passed.')

function createFakeWebGL2(state) {
  let id = 1
  const constants = new Map()
  const handle = type => ({ type, id: id++ })
  const target = {
    createShader: () => handle('shader'),
    shaderSource: (_shader, source) => state.shaderSources.push(source),
    compileShader() {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader() {},
    createProgram: () => handle('program'),
    attachShader() {}, linkProgram() {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram() {},
    getUniformLocation: (_program, name) => ({ name }),
    createTexture: () => { state.createdTextures += 1; return handle('texture') },
    deleteTexture: () => { state.deletedTextures += 1 },
    texImage2D: () => { state.textureUploads += 1 },
    texSubImage2D: () => { state.textureSubUploads += 1 },
    generateMipmap: () => { state.mipmaps += 1 },
    createVertexArray: () => handle('vao'),
    deleteVertexArray() {},
    createBuffer: () => handle('buffer'),
    deleteBuffer() {},
    getParameter(_name) { return 8192 },
    drawArrays: () => { state.draws += 1 },
    drawElements: () => { state.draws += 1 },
    drawArraysInstanced: () => { state.draws += 1 },
    drawElementsInstanced: () => { state.draws += 1 },
    getExtension: () => null
  }
  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property]
      if (typeof property === 'string' && /^[A-Z0-9_]+$/.test(property)) {
        if (!constants.has(property)) constants.set(property, id++)
        return constants.get(property)
      }
      return () => undefined
    }
  })
}

function createFakeWebGPU(state) {
  let id = 1
  const resource = type => ({ type, id: id++, destroy() {} })
  const queue = {
    writeTexture() {},
    copyExternalImageToTexture() { state.textureCopies += 1 },
    writeBuffer() {},
    submit() {}
  }
  const pass = {
    setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, setIndexBuffer() {},
    draw() { state.draws += 1 }, drawIndexed() { state.draws += 1 }, end() {}
  }
  let resolveDeviceLost
  const lost = new Promise(resolve => { resolveDeviceLost = resolve })
  const device = {
    limits: { maxTextureDimension2D: 8192 },
    features: new Set(),
    lost,
    queue,
    createBindGroupLayout: descriptor => ({ descriptor }),
    createPipelineLayout: descriptor => ({ descriptor }),
    createTexture(descriptor) {
      state.createdTextures += 1
      const texture = resource('texture')
      texture.descriptor = descriptor
      texture.createView = () => resource('view')
      texture.destroy = () => { state.destroyedTextures += 1 }
      return texture
    },
    createSampler: descriptor => { state.samplers.push(descriptor ?? {}); return { descriptor } },
    createBuffer(descriptor) {
      const buffer = resource('buffer')
      const bytes = new ArrayBuffer(descriptor.size)
      buffer.getMappedRange = () => bytes
      buffer.unmap = () => undefined
      return buffer
    },
    createShaderModule(descriptor) { state.shaderSources.push(descriptor.code); return { descriptor } },
    createRenderPipeline: descriptor => ({ descriptor }),
    createBindGroup(descriptor) { state.bindEntries.push(descriptor.entries.length); return { descriptor } },
    createCommandEncoder: () => ({ beginRenderPass: () => pass, finish: () => ({}) }),
    destroy() {}
  }
  const adapter = { limits: device.limits, requestDevice: async () => device }
  const gpu = { requestAdapter: async () => adapter, getPreferredCanvasFormat: () => 'bgra8unorm' }
  const context = {
    configure() {},
    getCurrentTexture() {
      const texture = resource('current-texture')
      texture.createView = () => resource('current-view')
      return texture
    }
  }
  return {
    gpu,
    context,
    loseDevice(info) { resolveDeviceLost?.(info) },
  }
}

function restoreGlobal(name, value) {
  if (value === undefined) delete globalThis[name]
  else Object.defineProperty(globalThis, name, { configurable: true, value })
}
