import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Mesh, Scene } from '@sekai64-internal/scene'
import { RenderQueueBuilder } from './RenderQueue.js'

describe('RenderQueueBuilder shadow casters', () => {
  it('keeps off-screen shadow casters independent of the main camera visibility queue', () => {
    const scene = new Scene()
    const caster = new Mesh({
      geometry: new BoxGeometry({ width: 2, height: 4, depth: 2 }),
      material: new BasicMaterial(),
      castShadow: true,
    })
    caster.position.set(50, 2, -10)
    scene.add(caster)
    scene.updateWorldMatrix()

    const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 1, near: 0.1, far: 100 })
    camera.position.set(0, 2, 0)
    camera.lookAt([0, 2, -10])
    camera.updateMatrices()

    const builder = new RenderQueueBuilder()
    const visible = builder.build(scene, camera, { frustumCulling: true })
    expect(visible.opaque).toHaveLength(0)
    expect(visible.frustumCulled).toBe(1)

    const shadowCasters = builder.buildShadowCasters(scene, { frustumCulling: true })
    expect(shadowCasters).toHaveLength(1)
    expect(shadowCasters[0]?.mesh).toBe(caster)
  })

  it('excludes transparent and non-shadow-casting meshes from the caster queue', () => {
    const scene = new Scene()
    const noShadow = new Mesh({ geometry: new BoxGeometry(), material: new BasicMaterial(), castShadow: false })
    const transparentMaterial = new BasicMaterial({ transparent: true })
    const transparent = new Mesh({ geometry: new BoxGeometry(), material: transparentMaterial, castShadow: true })
    scene.add(noShadow, transparent)
    scene.updateWorldMatrix()

    const builder = new RenderQueueBuilder()
    expect(builder.buildShadowCasters(scene)).toHaveLength(0)
  })
})
