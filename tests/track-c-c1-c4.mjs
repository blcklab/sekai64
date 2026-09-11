import assert from 'node:assert/strict'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Box3, Frustum, Ray, Vector3 } from '@sekai64-internal/math'
import { LevelOfDetail, Mesh, Node, Scene } from '@sekai64-internal/scene'
import {
  ClusteredLightGrid,
  GeometryResidencyManager,
  HierarchicalDepthCuller,
  RendererPerformanceProfiler,
  RenderQueueBuilder,
  createRendererStats,
  resolveOptimization,
} from '@sekai64-internal/renderer'
import { SpatialMeshIndex, VisibilityRegionIndex, WorldOriginRebaser } from '@sekai64-internal/large-scene'
import { AssetTaskScheduler, RegionStreamingController } from '@sekai64-internal/streaming'

// C1: dirty transform propagation skips clean subtrees.
const root = new Node({ id: 'root' })
const branch = new Node({ id: 'branch' })
const leaf = new Node({ id: 'leaf' })
root.add(branch); branch.add(leaf)
const firstTransform = root.updateWorldMatrixTracked()
assert.equal(firstTransform.updated, 3)
const cleanTransform = root.updateWorldMatrixTracked()
assert.equal(cleanTransform.updated, 0)
assert.equal(cleanTransform.skippedSubtrees, 1)
leaf.position.x = 2
const dirtyTransform = root.updateWorldMatrixTracked()
assert.ok(dirtyTransform.updated >= 1)
assert.ok(dirtyTransform.visited <= 3)

const geometry = new BoxGeometry()
const material = new BasicMaterial({ baseColor: '#ffffff' })
const scene = new Scene()
for (let index = 0; index < 40; index += 1) {
  const mesh = new Mesh({ id: `mesh-${index}`, geometry, material })
  mesh.position.set((index % 8) - 4, Math.floor(index / 8) - 2, -8 - index * 0.25)
  if (index % 5 === 0) mesh.tags.add('static-batch')
  scene.add(mesh)
}
scene.updateWorldMatrix()
const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 16 / 9, near: 0.1, far: 200 })
camera.updateWorldMatrix(true); camera.updateMatrices()
const queueBuilder = new RenderQueueBuilder()
const optimization = resolveOptimization({ frustumCulling: true, cachedBounds: true, pipelineSorting: true, hizOcclusion: false })
const queue1 = queueBuilder.build(scene, camera, optimization, undefined, 720)
const queue2 = queueBuilder.build(scene, camera, optimization, undefined, 720)
assert.ok(queue1.opaque.length > 0)
assert.ok(queue2.boundsCacheHits >= queue1.boundsCacheHits)
assert.ok(queue2.sortMs >= 0 && queue2.buildMs >= 0)
assert.equal(queue2.itemAllocations, 0)
assert.ok(queue2.itemPoolSize >= queue2.opaque.length + queue2.transparent.length)

// C2: spatial hierarchy, visibility regions, LOD, rebasing, streaming, residency.
const spatial = new SpatialMeshIndex()
spatial.rebuild(scene)
assert.equal(spatial.stats.entries, 40)
assert.ok(spatial.stats.nodes > 1)
const visibleFrustum = new Frustum().setFromProjectionMatrix(camera.viewProjectionMatrix)
assert.ok(spatial.queryFrustum(visibleFrustum).length > 0)
assert.ok(spatial.queryRay(new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, -1))).length > 0)
const moved = scene.require('mesh-0')
moved.position.x += 50; scene.updateWorldMatrix()
spatial.sync(scene)
assert.ok(spatial.stats.updatedEntries >= 1)

const lod = new LevelOfDetail({ mode: 'screen-size' })
const lodHigh = new Node({ id: 'lod-high' })
const lodLow = new Node({ id: 'lod-low' })
lod.addScreenLevel(lodHigh, 100).addScreenLevel(lodLow, 0)
lod.updateWorldMatrix()
assert.equal(lod.updateForCamera(new Vector3(0, 0, 2), 0, { viewportHeight: 720, projectionScaleY: 1 }), lodHigh)
assert.equal(lod.updateForCamera(new Vector3(0, 0, 1000), 0, { viewportHeight: 720, projectionScaleY: 1 }), lodLow)

const regions = new VisibilityRegionIndex()
regions.add({ id: 'near', bounds: new Box3(new Vector3(-5,-5,-5), new Vector3(5,5,5)), loadDistance: 20, priority: 2 })
regions.add({ id: 'far', bounds: new Box3(new Vector3(100,-5,-5), new Vector3(110,5,5)), loadDistance: 10 })
assert.equal(regions.evaluate(new Vector3()).filter(value => value.desiredResident).map(value => value.region.id)[0], 'near')

const worldRoot = new Node({ id: 'world-root' }); worldRoot.position.set(10_500, 0, 0)
const rebaser = new WorldOriginRebaser({ threshold: 10_000, gridSize: 1_000 })
const shift = rebaser.update(new Vector3(10_500, 0, 0), [worldRoot])
assert.equal(shift.shifted, true)
assert.equal(shift.offset[0], 11_000)
assert.equal(rebaser.toGlobal(new Vector3(-500, 0, 0)).x, 10_500)

const geometryEvictions = []
const geometryResidency = new GeometryResidencyManager(100, 1)
const residencyA = {}, residencyB = {}
geometryResidency.touch(residencyA, 80, 0, () => geometryEvictions.push('a'))
geometryResidency.touch(residencyB, 80, 0, () => geometryEvictions.push('b'))
assert.ok(geometryResidency.enforce(2) >= 1)
assert.ok(geometryEvictions.length >= 1)

const scheduler = new AssetTaskScheduler({ concurrency: 1, maximumQueued: 8 })
const progress = []
const disposedValues = []
const firstLease = await scheduler.schedule('region-one', async ({ report }) => { report(0.5, 'half'); return { id: 1 } }, { estimatedBytes: 64, onProgress: (value) => progress.push(value), disposeValue: value => disposedValues.push(value.id) })
assert.deepEqual(progress, [0.5])
firstLease.dispose()
assert.equal(scheduler.stats.residentBytes, 64)
assert.equal(scheduler.clearUnused(0), 1)
assert.deepEqual(disposedValues, [1])

const streaming = new RegionStreamingController(scheduler)
streaming.add({ id: 'town', center: [0,0,0], loadDistance: 20, unloadDistance: 30, estimatedBytes: 32, async load(){ return 'town-loaded' } })
let streamStats = await streaming.updateAndWait({ x: 0, y: 0, z: 0 })
assert.equal(streaming.get('town'), 'town-loaded')
assert.equal(streamStats.resident, 1)
streamStats = await streaming.updateAndWait({ x: 100, y: 0, z: 0 })
assert.equal(streamStats.resident, 0)
streaming.dispose(); scheduler.dispose()

// C3: history-safe Hi-Z and deterministic clustered-light budgets.
const bounds = new Box3(new Vector3(-1,-1,-6), new Vector3(1,1,-4))
const hiz = new HierarchicalDepthCuller({ baseResolution: 64, historyFrames: 2, minimumProjectedPixels: 2 })
hiz.beginFrame(camera, 1280, 720)
assert.equal(hiz.isOccluded(scene, bounds), false)
hiz.submitOccluder(bounds); hiz.endFrame()
assert.ok(hiz.stats.levels > 1)

const lights = Array.from({ length: 48 }, (_, index) => ({
  id: `light-${index}`,
  priority: index === 0 ? 10 : 0,
  castShadow: index === 0,
  positionRange: [(index % 8) - 4, Math.floor(index / 8) - 3, -6 - (index % 3), 12],
  colorDecay: [1, 0.8, 0.6, 2],
}))
const clusters = new ClusteredLightGrid({ dimensions: [8,4,12], maxLightsPerCluster: 4, maxVisibleLights: 24 })
clusters.build(camera, lights)
const firstClusterStats = clusters.stats
assert.equal(firstClusterStats.visibleLights, 24)
assert.equal(firstClusterStats.rejectedLights, 24)
assert.ok(firstClusterStats.maximumClusterOccupancy <= 4)
const buffers = clusters.createGpuBuffers()
assert.equal(buffers.offsets.length, clusters.clusterCount + 1)
clusters.build(camera, lights)
assert.ok(clusters.stats.cacheHits > firstClusterStats.cacheHits)

// C4: allocation-bounded telemetry aggregation.
const rendererStats = createRendererStats()
rendererStats.cpuFrameMs = 16
rendererStats.gpuFrameMs = 10
rendererStats.fps = 60
rendererStats.drawCalls = 100
rendererStats.triangles = 50_000
rendererStats.visibleObjects = 500
rendererStats.culledObjects = 500
const profiler = new RendererPerformanceProfiler(4)
profiler.beginFrame(); profiler.beginPhase('queue'); profiler.endPhase('queue'); profiler.record(rendererStats)
rendererStats.cpuFrameMs = 20; rendererStats.fps = 50
profiler.beginFrame(); profiler.record(rendererStats)
const summary = profiler.summary()
assert.equal(summary.frames, 2)
assert.equal(summary.averageDrawCalls, 100)
assert.ok(summary.p95CpuFrameMs >= 20)
assert.equal(profiler.exportFrames().length, 2)

geometry.dispose(); material.dispose(); scene.dispose(); lod.dispose(); root.dispose(); worldRoot.dispose()
console.log('Sekai64 Track C C1-C4 behavior assertions passed.')
