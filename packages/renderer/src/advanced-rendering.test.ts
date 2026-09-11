import { describe, expect, it } from 'vitest'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { PointLight } from '@sekai64-internal/lighting'
import { StandardMaterial } from '@sekai64-internal/materials'
import { Box3, Vector3 } from '@sekai64-internal/math'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { Mesh, Node } from '@sekai64-internal/scene'
import { batchStaticMeshes, ClusteredLightGrid, createBloomPyramid, createGtaoKernel, HierarchicalDepthCuller, TextureResidencyManager } from './AdvancedRendering.js'
import { collectSceneLights } from '@sekai64-internal/lighting'
import { Scene } from '@sekai64-internal/scene'

describe('advanced rendering planners', () => {
  it('creates deterministic GTAO and normalized bloom plans', () => {
    expect(createGtaoKernel(12)).toHaveLength(12)
    const levels = createBloomPyramid(1920, 1080, 5, 0.7)
    expect(levels.map(level => [level.width, level.height])).toEqual([[960, 540], [480, 270], [240, 135], [120, 67], [60, 33]])
    expect(levels.reduce((sum, level) => sum + level.weight, 0)).toBeCloseTo(1)
  })

  it('builds a conservative hierarchical depth history', () => {
    const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 1, near: 0.1, far: 100 })
    camera.position.set(0, 0, 5)
    camera.updateMatrices()
    const culler = new HierarchicalDepthCuller(32)
    culler.beginFrame(camera, 512, 512)
    culler.submitOccluder(new Box3(new Vector3(-2, -2, -0.25), new Vector3(2, 2, 0.25)))
    culler.endFrame()
    culler.beginFrame(camera, 512, 512)
    expect(culler.isOccluded(new Box3(new Vector3(-0.5, -0.5, -4.5), new Vector3(0.5, 0.5, -3.5)))).toBe(true)
  })

  it('selects local lights from a clustered grid', () => {
    const scene = new Scene()
    for (let index = 0; index < 12; index += 1) {
      const light = new PointLight({ range: 4 })
      light.position.set(index - 6, 0, -6)
      scene.add(light)
    }
    scene.updateWorldMatrix()
    const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 1, near: 0.1, far: 100 })
    camera.updateMatrices()
    const summary = collectSceneLights(scene, 32, undefined, 0)
    const grid = new ClusteredLightGrid({ dimensions: [8, 4, 8], maxLightsPerCluster: 4 })
    grid.build(camera, summary.pointLights)
    expect(grid.selectForBounds(new Box3(new Vector3(-0.5, -0.5, -6.5), new Vector3(0.5, 0.5, -5.5))).length).toBeLessThanOrEqual(4)
    expect(grid.clusterCount).toBe(256)
  })

  it('batches repeated static sibling meshes', () => {
    const root = new Node()
    const geometry = new BoxGeometry()
    const material = new StandardMaterial()
    for (let index = 0; index < 3; index += 1) root.add(new Mesh({ geometry, material, ownsGeometry: index === 0, ownsMaterial: index === 0 }))
    const result = batchStaticMeshes(root, { minInstances: 3 })
    expect(result).toEqual({ batches: 1, sourceMeshes: 3, instances: 3 })
    expect(root.children).toHaveLength(1)
  })

  it('evicts old texture residency entries under budget pressure', () => {
    const manager = new TextureResidencyManager<object>(100, 2)
    const a = {}, b = {}
    let evicted = 0
    manager.touch(a, 80, 0, () => { evicted += 1 })
    manager.touch(b, 80, 3, () => { evicted += 1 })
    expect(manager.enforce(3)).toBe(1)
    expect(evicted).toBe(1)
  })
})
