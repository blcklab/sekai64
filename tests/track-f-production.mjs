import assert from 'node:assert/strict'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Frustum } from '@sekai64-internal/math'
import { Mesh, Scene } from '@sekai64-internal/scene'
import { ClusteredLightGrid, RendererPerformanceProfiler, RenderQueueBuilder, createRendererStats, resolveOptimization } from '@sekai64-internal/renderer'
import { SpatialMeshIndex } from '@sekai64-internal/large-scene'

const geometry = new BoxGeometry()
const materials = Array.from({ length: 8 }, (_, index) => new BasicMaterial({ baseColor: [index / 8, 0.5, 1 - index / 8] }))
const scene = new Scene()
for (let index = 0; index < 10_000; index += 1) {
  const mesh = new Mesh({ id: `track-f-${index}`, geometry, material: materials[index % materials.length] })
  mesh.position.set((index % 100) - 50, Math.floor(index / 100) % 10, -8 - Math.floor(index / 100))
  scene.add(mesh)
}
const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 16 / 9, near: 0.1, far: 600 })
camera.position.set(0, 20, 20)
camera.rotation.x = -0.35
scene.updateWorldMatrixTracked(); camera.updateWorldMatrix(true); camera.updateMatrices()

const optimization = resolveOptimization({ frustumCulling: true, cachedBounds: true, pipelineSorting: true, hizOcclusion: false })
const builder = new RenderQueueBuilder()
const first = builder.build(scene, camera, optimization, undefined, 1080)
const second = builder.build(scene, camera, optimization, undefined, 1080)
assert.ok(first.opaque.length > 0)
assert.equal(second.itemAllocations, 0)
assert.ok(second.boundsCacheHits >= first.boundsCacheHits)
assert.ok(second.itemPoolSize >= second.opaque.length + second.transparent.length)

const spatial = new SpatialMeshIndex()
spatial.rebuild(scene)
assert.equal(spatial.stats.entries, 10_000)
const frustum = new Frustum().setFromProjectionMatrix(camera.viewProjectionMatrix)
assert.ok(spatial.queryFrustum(frustum).length > 0)

const lights = Array.from({ length: 512 }, (_, index) => ({
  id: `light-${index}`, priority: index < 8 ? 2 : 0, castShadow: index < 2,
  positionRange: [(index % 32) - 16, 5, -10 - Math.floor(index / 32) * 8, 30], colorDecay: [1, 0.8, 0.6, 2],
}))
const clusters = new ClusteredLightGrid({ dimensions: [16, 9, 24], maxLightsPerCluster: 24, maxVisibleLights: 256 })
clusters.build(camera, lights)
assert.equal(clusters.stats.visibleLights, 256)
assert.equal(clusters.stats.rejectedLights, 256)
assert.ok(clusters.stats.maximumClusterOccupancy <= 24)
const firstHits = clusters.stats.cacheHits
clusters.build(camera, lights)
assert.ok(clusters.stats.cacheHits > firstHits)

const profiler = new RendererPerformanceProfiler(120)
const stats = createRendererStats()
for (let frame = 0; frame < 240; frame += 1) {
  stats.cpuFrameMs = 14 + (frame % 5)
  stats.gpuFrameMs = 8 + (frame % 3)
  stats.fps = 1000 / stats.cpuFrameMs
  stats.drawCalls = second.opaque.length
  stats.visibleObjects = second.opaque.length + second.transparent.length
  stats.culledObjects = second.frustumCulled
  profiler.beginFrame(); profiler.record(stats)
}
assert.equal(profiler.exportFrames().length, 120)
assert.equal(profiler.summary().frames, 120)

for (const material of materials) material.dispose()
geometry.dispose(); scene.dispose()
console.log('Sekai64 Track F production-scale behavior assertions passed.')
