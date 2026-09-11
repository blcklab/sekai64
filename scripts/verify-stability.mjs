import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const workspace = await readJson('package.json')
const pkg = await readJson('packages/sekai64/package.json')
const expectedVersion = String(pkg.version ?? '')

assert.ok(expectedVersion, 'The public Sekai64 package must declare a version.')
assert.equal(workspace.version, expectedVersion, 'Workspace and public package versions must match.')
assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'Sekai64 must keep zero runtime dependencies.')

const packageEntries = await readdir(new URL('packages/', root), { withFileTypes: true })
for (const entry of packageEntries) {
  if (!entry.isDirectory()) continue
  const internalPackage = await readJson(`packages/${entry.name}/package.json`)
  assert.equal(
    internalPackage.version,
    expectedVersion,
    `packages/${entry.name}/package.json must match the public package version.`,
  )
}

const expectedSubpaths = [
  '.', './animation', './assets', './buildings', './cameras', './collision', './controls', './core', './decoders', './dynamic-texture', './environment', './environment-authoring', './geometry', './geometry/beveled-box', './gltf', './interaction', './large-scene', './lighting', './materials', './math', './modules', './package.json', './postprocessing', './recovery', './renderer', './renderers/webgl2', './renderers/webgpu', './scene', './schemas/scene-v2.json', './streaming', './texture-tools', './xr',
].sort()
assert.deepEqual(Object.keys(pkg.exports).sort(), expectedSubpaths)

const expectedRoot = `AmbientLight BasicMaterial Box3 BoxGeometry Camera Color CylinderGeometry DepthMaterial DirectionalLight Engine EnvironmentLight Euler EventDispatcher Frustum Geometry ImageMesh InstancedMesh LevelOfDetail Light LoadedScene ManagedResource Material Matrix3 Matrix4 Mesh Node NormalMaterial OrthographicCamera PerspectiveCamera Plane PlaneGeometry PointLight Quaternion Ray Rectangle ResourceManager ResourceScope SEKAI64_VERSION Scene Sekai64Error ShaderMaterial Sphere SpotLight StandardMaterial TextMesh Texture TextureMaterial Vector2 Vector3 Vector4 WaterMaterial batchStaticMeshes bindJsonInteractions collectSceneLights createBrowserActionsPlugin createBuildingsPlugin createEngine createGltfPlugin createScene createTextTexture glsl loadSceneDefinition loadTexture migrateSceneDefinition validateSceneDefinition wgsl`.split(' ').sort()
const rootModule = await import(new URL('packages/sekai64/dist/index.js', root))
assert.deepEqual(Object.keys(rootModule).sort(), expectedRoot)
assert.equal(rootModule.SEKAI64_VERSION, expectedVersion)

const modules = await import(new URL('packages/sekai64/dist/modules/index.js', root))
assert.equal(modules.SEKAI64_MODULE_VERSION, expectedVersion)

const dynamic = await import(new URL('packages/sekai64/dist/dynamic-texture/index.js', root))
assert.deepEqual(Object.keys(dynamic).sort(), ['createDynamicTextureCapability'])
const interaction = await import(new URL('packages/sekai64/dist/interaction/index.js', root))
assert.deepEqual(Object.keys(interaction).sort(), ['InteractionManager', 'Raycaster', 'SceneActionRegistry'])
const beveled = await import(new URL('packages/sekai64/dist/geometry/beveled-box/index.js', root))
assert.ok('BeveledBoxGeometry' in beveled, 'BeveledBoxGeometry must remain available from ./geometry/beveled-box.')
const materials = await import(new URL('packages/sekai64/dist/materials/index.js', root))
for (const name of ['ShaderMaterial', 'StandardMaterial', 'Texture']) assert.ok(name in materials, `${name} must remain exported.`)

const rendererTypes = await readFile(new URL('packages/sekai64/dist/renderer/Renderer.d.ts', root), 'utf8').catch(() => '')
assert.ok(rendererTypes.includes('export interface Renderer'), 'Renderer declaration must remain published.')
const dynamicTypes = (await readFile(new URL('packages/sekai64/dist/dynamic-texture/index.d.ts', root), 'utf8')) + (await readFile(new URL('packages/sekai64/dist/dynamic-texture/DynamicTexture.d.ts', root), 'utf8'))
for (const name of ['DynamicTexture', 'DynamicTextureCapability', 'createDynamicTextureCapability']) assert.ok(dynamicTypes.includes(name), `${name} must remain declared.`)

const optionalExports = {
  animation: ['AnimationClip', 'AnimationMixer', 'AnimationRendererModule', 'createGltfAnimationAdapter', 'SkeletonResource', 'SkinnedGeometry'],
  decoders: ['DecoderRegistry'],
  environment: ['EnvironmentRendererModule', 'EnvironmentResource', 'decodeRadianceHdr'],
  'environment-authoring': ['createProceduralSky', 'prefilterEnvironment', 'packPrefilteredEnvironment'],
  'texture-tools': ['TextureDecoderRegistry', 'generateRgba8MipChain', 'toTextureDataSource'],
  'large-scene': ['LargeSceneRendererModule', 'ShadowBudgetManager', 'SpatialMeshIndex'],
  modules: ['RendererModuleHost', 'SEKAI64_MODULE_VERSION'],
  recovery: ['RendererRecoveryModule'],
  streaming: ['AssetTaskScheduler', 'StreamingRendererModule', 'WorkerTaskPool'],
}
const optionalModules = {}
for (const [subpath, names] of Object.entries(optionalExports)) {
  const value = await import(new URL(`packages/sekai64/dist/${subpath}/index.js`, root))
  optionalModules[subpath] = value
  for (const name of names) assert.ok(name in value, `${name} must remain exported by ./${subpath}.`)
}

const rendererModules = [
  optionalModules.animation.createAnimationRendererModule(),
  optionalModules.environment.createEnvironmentRendererModule(),
  optionalModules['large-scene'].createLargeSceneRendererModule(),
  optionalModules.recovery.createRendererRecoveryModule(),
  optionalModules.streaming.createStreamingRendererModule(),
]
for (const module of rendererModules) {
  assert.equal(module.version, expectedVersion, `${module.id} must report the current Sekai64 version.`)
}

console.log(`Verified Sekai64 ${expectedVersion} modular export, renderer, animation, streaming, environment, recovery, and legacy contracts.`)
