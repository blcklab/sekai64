import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
const renderQueue = await readFile(new URL('../packages/renderer/src/RenderQueue.ts', import.meta.url), 'utf8')
for (const [name, source] of [['WebGL2', webgl], ['WebGPU', webgpu]]) {
  for (const feature of ['toneMap', 'distributionGGX', 'shadow', 'transmission', 'environment']) {
    assert.match(source.toLowerCase(), new RegExp(feature.toLowerCase()), `${name} is missing ${feature}`)
  }
  assert.match(source, /metallicTexture/)
  assert.match(source, /roughnessTexture/)
}
assert.match(webgl, /outputTransform/)
assert.match(webgpu, /outputTransform/)

assert.match(webgl, /envKd\*base\*env\*ao\/PI/, 'WebGL2 environment diffuse must be energy conserving and Lambert-normalized')
assert.match(webgpu, /envKd\*base\*env\*ao\/PI/, 'WebGPU environment diffuse must be energy conserving and Lambert-normalized')
assert.match(webgl, /u_environmentBrdfLut/)
assert.match(webgpu, /environmentBrdfTexture/)
assert.match(webgl, /transpose\(inverse\(model3\)\)/, 'WebGL2 normals must use inverse-transpose transforms')
assert.match(webgpu, /cofactor0=cross/, 'WebGPU normals must use an inverse-transpose equivalent')
console.log('Sekai64 S1–S7 WebGL2/WebGPU shader feature parity verification passed.')

assert.match(
  webgpu,
  /vec2<f32>\(projected\.x\*0\.5\+0\.5,0\.5-projected\.y\*0\.5\)/,
  'WebGPU directional-shadow lookup must flip projected Y into texture coordinates',
)


assert.match(webgpu, /cameraView\*vec4<f32>\(worldPosition,1\.0\)/, 'WebGPU cascades must select by camera view depth, not Euclidean camera distance')
assert.doesNotMatch(webgpu, /cameraDistance=distance\(uniforms\.cameraPosition\.xyz,worldPosition\)/, 'WebGPU shadow cascade selection must not use spherical camera-distance boundaries')
assert.match(webgpu, /buildShadowCasters\(scene, this\.optimization\)/, 'WebGPU shadow pass must collect casters independently of the visible render queue')
assert.match(webgl, /buildShadowCasters\(scene, this\.optimization\)/, 'WebGL2 shadow pass must collect casters independently of the visible render queue')
assert.match(renderQueue, /buildShadowCasters\(scene: Scene/, 'RenderQueueBuilder must expose a camera-independent shadow caster queue')
assert.match(webgpu, /shadowFrustum\.intersectsBox\(item\.worldBounds\)/, 'WebGPU shadow caster culling must use the light cascade frustum')
assert.match(webgl, /shadowFrustum\.intersectsBox\(entry\.worldBounds\)/, 'WebGL2 shadow caster culling must use the light cascade frustum')

assert.match(webgpu, /new Map<Mesh, WebGPUShadowUniform\[\]>\(\)/, 'WebGPU shadow uniforms must be isolated per mesh and cascade')
assert.match(webgpu, /getShadowUniform\(mesh, frame\.index\)/, 'WebGPU shadow pass must bind a cascade-specific uniform buffer')
assert.match(webgpu, /cascades\[cascadeIndex\] = uniform/, 'WebGPU shadow uniform cache must retain a distinct buffer for each cascade')
assert.doesNotMatch(webgpu, /const uniform=this\.getShadowUniform\(mesh\)\n/, 'WebGPU must not reuse one shadow uniform buffer across cascades in a single command buffer')
