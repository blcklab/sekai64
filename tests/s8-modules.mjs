import assert from 'node:assert/strict'
import {
  AmbientLight,
  BasicMaterial,
  Geometry,
  Mesh,
  Node,
  Scene,
  SpotLight,
  Vector3,
  collectSceneLights,
} from '@blcklab/sekai64'
import { RendererModuleHost } from '@blcklab/sekai64/modules'
import {
  AnimationClip,
  AnimationMixer,
  AnimationRendererModule,
  AnimationTrack,
  SkeletonResource,
  SkinnedGeometry,
} from '@blcklab/sekai64/animation'
import { DecoderRegistry } from '@blcklab/sekai64/decoders'
import { AssetTaskScheduler, WorkerTaskPool } from '@blcklab/sekai64/streaming'
import { EnvironmentResource, toneMap } from '@blcklab/sekai64/environment'
import { ShadowBudgetManager, SpatialMeshIndex } from '@blcklab/sekai64/large-scene'
import { RendererRecoveryModule } from '@blcklab/sekai64/recovery'

const fakeCapabilities = {
  backend: 'webgl2', maxTextureSize: 4096, maxPointLights: 8, maxSpotLights: 4,
  computeShaders: false, timestampQueries: false, instancing: true, offscreenCanvas: false,
  features: {
    text: true, images: true, models: true, ambientLights: true, directionalLights: true,
    pointLights: true, spotLights: true, picking: true, trianglePicking: true,
    instancedPicking: true, shadows: false, wireframe: false, baseColorTextures: true,
    normalTextures: true, metallicRoughnessTextures: true, emissiveTextures: true,
    occlusionTextures: true, vertexColors: true, alphaMask: true, alphaBlend: true,
    doubleSidedMaterials: true, xr: false, skinning: false, morphTargets: false,
    environmentMaps: false, hdrEnvironment: false, imageBasedLighting: false,
    automaticRecovery: true,
  },
  advanced: { maxJoints: 0, maxMorphTargets: 0, shaderVariants: ['static'] },
}
const fakeRenderer = {
  backend: 'webgl2', capabilities: fakeCapabilities,
  stats: { drawCalls: 0, triangles: 0, visibleObjects: 0, culledObjects: 0, pipelineChanges: 0, geometryMemory: 0, textureMemory: 0 },
  width: 1, height: 1, pixelRatio: 1, disposed: false,
  async initialize() {}, resize() {}, setClearColor() {}, render() {}, dispose() {},
}

// S8.0 module lifecycle and dependency ordering.
{
  const order = []
  const module = (id, requires = []) => ({
    id, requires,
    setup(context) {
      order.push(`setup:${id}`)
      context.registerCleanup(() => order.push(`cleanup:${id}`))
      return { dispose: () => order.push(`dispose:${id}`) }
    },
  })
  const host = new RendererModuleHost(fakeRenderer)
  await host.installAll([module('b', ['a']), module('a')])
  assert.deepEqual(order, ['setup:a', 'setup:b'])
  await host.disposeAsync()
  assert.deepEqual(order, ['setup:a', 'setup:b', 'dispose:b', 'cleanup:b', 'dispose:a', 'cleanup:a'])
  await assert.rejects(
    new RendererModuleHost(fakeRenderer).installAll([
      { id: 'a', requires: ['b'], setup() {} },
      { id: 'b', requires: ['a'], setup() {} },
    ]),
    /dependency cycle/,
  )
}

// S8.1-S8.5 skeletons, morphs, clips, mixers, and dynamic deformation.
{
  const root = new Node({ id: 'root' })
  const child = new Node({ id: 'child' })
  root.add(child)
  const clip = new AnimationClip({
    id: 'move',
    tracks: [new AnimationTrack({
      target: 'child', path: 'translation',
      times: new Float32Array([0, 1]),
      values: new Float32Array([0, 0, 0, 2, 0, 0]),
    })],
  })
  const mixer = new AnimationMixer(root, [clip])
  mixer.play('move', { loop: 'once' })
  mixer.update(0.5)
  assert.ok(Math.abs(child.position.x - 1) < 1e-6)

  const joint = new Node({ id: 'joint' })
  joint.position.x = 1
  const skeleton = new SkeletonResource({ id: 'skeleton', joints: [joint] })
  assert.ok(Math.abs(skeleton.palette[12] - 1) < 1e-6)

  const geometry = new SkinnedGeometry({
    positions: new Float32Array([0, 0, 0]),
    morphTargets: [{ name: 'up', positions: new Float32Array([0, 1, 0]) }],
  })
  geometry.setMorphWeight('up', 0.5).deform()
  assert.ok(Math.abs(geometry.positions[1] - 0.5) < 1e-6)
  assert.equal(geometry.basePositions[1], 0)

  const mesh = new Mesh({ geometry, material: new BasicMaterial(), ownsResources: true })
  const animation = new AnimationRendererModule()
  const instance = animation.setup({ renderer: fakeRenderer, diagnostics: { report() {} }, registerCleanup() { return () => {} } })
  animation.bind(mesh)
  instance.update?.({ deltaTime: 0, elapsedTime: 0, frame: 0 })
  assert.equal(instance.capabilities?.skinning, true)
  assert.deepEqual(instance.capabilities?.shaderVariants, ['static', 'skinned', 'morph', 'skinned-morph'])
  animation.dispose()
}

// S8.6 explicit decoders and deterministic cleanup.
{
  const decoders = new DecoderRegistry()
  await assert.rejects(decoders.decode({ format: 'draco', data: new ArrayBuffer(0) }), /explicit optional adapter/)
  let disposed = false
  decoders.register({
    id: 'test', formats: ['foo'],
    async decode(request) { return { kind: 'bytes', value: request.data.byteLength } },
    dispose() { disposed = true },
  })
  assert.equal((await decoders.decode({ format: '.FOO', data: new ArrayBuffer(4) })).value, 4)
  await decoders.disposeAsync()
  assert.equal(disposed, true)
}

// S8.7 priority scheduling, deduplication, and worker-compatible execution.
{
  const scheduler = new AssetTaskScheduler(1)
  let runs = 0
  const execute = async () => { runs += 1; return 7 }
  const [a, b] = await Promise.all([scheduler.schedule('same', execute), scheduler.schedule('same', execute)])
  assert.equal(a.value, 7)
  assert.equal(b.value, 7)
  assert.equal(runs, 1)
  a.dispose(); b.dispose(); scheduler.dispose()

  const pool = new WorkerTaskPool(async value => value * 2)
  const result = await pool.run(4)
  assert.equal(result, 8)
  pool.dispose()
}

// S8.8 HDR/tone-mapping resource behavior.
{
  assert.ok(toneMap(10, 'aces') > 0.9)
  const environment = new EnvironmentResource({ id: 'studio', width: 1, height: 1, pixels: new Float32Array([2, 1, 0]) })
  assert.equal(environment.average.r, 2)
  assert.equal(environment.toLdr().length, 4)
  environment.dispose()
}

// S8.9 spot lights, shadow budgets, and spatial picking acceleration.
{
  const scene = new Scene()
  const spot = new SpotLight({ id: 'spot', direction: [0, -1, 0], innerCone: Math.PI / 8, outerCone: Math.PI / 4 })
  spot.position.set(0, 2, 0)
  scene.add(spot)
  scene.updateWorldMatrix()
  const summary = collectSceneLights(scene, 8, new Vector3(), 4)
  assert.equal(summary.spotCount, 1)
  assert.equal(summary.selectedSpotCount, 1)
  assert.equal(summary.spotLights.length, 1)

  const shadow = new AmbientLight({ id: 'shadow' })
  shadow.castShadow = true
  const allocations = new ShadowBudgetManager({ maxLights: 1, maxPixels: 1024 * 1024 }).allocate([{ light: shadow, priority: 1 }])
  assert.equal(allocations.length, 1)

  const mesh = new Mesh({
    geometry: new Geometry({ positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]) }),
    material: new BasicMaterial(),
    ownsResources: true,
  })
  scene.add(mesh)
  const index = new SpatialMeshIndex().rebuild(scene)
  assert.equal(index.size, 1)
}

// S8.10 recovery orchestration and resource restoration.
{
  let recoveries = 0
  let restorations = 0
  const recoverable = {
    ...fakeRenderer,
    async recover(options = {}) {
      recoveries += 1
      options.onProgress?.(0.5, 'device')
      options.onProgress?.(1, 'complete')
    },
  }
  const recovery = new RendererRecoveryModule({ maxAttempts: 2 })
  recovery.setup({ renderer: recoverable, diagnostics: { report() {} }, registerCleanup() { return () => {} } })
  recovery.register({ id: 'texture', restore() { restorations += 1 } })
  await recovery.recover('test')
  assert.equal(recoveries, 1)
  assert.equal(restorations, 1)
  assert.throws(() => recovery.register({ id: 'texture', restore() {} }), /already registered/)
  recovery.dispose()
}

console.log('Sekai64 S8.0-S8.10 runtime assertions passed.')
