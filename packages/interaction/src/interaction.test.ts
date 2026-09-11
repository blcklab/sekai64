import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry, Geometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Matrix4, Vector2, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, Mesh, Scene } from '@sekai64-internal/scene'
import { Raycaster } from './Raycaster.js'

describe('Raycaster', () => {
  it('selects a box at the center of the camera', () => {
    const scene = new Scene()
    const box = new Mesh({ geometry: new BoxGeometry(), material: new BasicMaterial(), ownsResources: true })
    scene.add(box)
    const camera = new PerspectiveCamera({ aspect: 1 }); camera.position.z = 5; camera.updateMatrices()
    const hit = new Raycaster().setFromCamera(new Vector2(), camera).intersectScene(scene, { firstHitOnly: true })[0]
    expect(hit?.object).toBe(box)
    expect(hit?.triangleIndex).toBeTypeOf('number')
    scene.dispose(); camera.dispose()
  })

  it('can distinguish bounds hits from triangle hits', () => {
    const geometry = new Geometry({
      positions: new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
    })
    const mesh = new Mesh({ geometry, material: new BasicMaterial(), ownsResources: true })
    const scene = new Scene().add(mesh); scene.updateWorldMatrix()
    const raycaster = new Raycaster()
    raycaster.ray.set(new Vector3(0.8, 0.8, 5), new Vector3(0, 0, -1))
    expect(raycaster.intersectMesh(mesh, 'bounds')).not.toBeNull()
    expect(raycaster.intersectMesh(mesh, 'triangles')).toBeNull()
    scene.dispose()
  })

  it('returns the picked instance ID', () => {
    const mesh = new InstancedMesh({ geometry: new BoxGeometry(), material: new BasicMaterial(), count: 2, ownsResources: true })
    const translated = new Matrix4(); translated.elements[12] = 3
    mesh.setMatrixAt(1, translated)
    const scene = new Scene().add(mesh); scene.updateWorldMatrix()
    const raycaster = new Raycaster()
    raycaster.ray.set(new Vector3(3, 0, 5), new Vector3(0, 0, -1))
    expect(raycaster.intersectMesh(mesh)?.instanceId).toBe(1)
    scene.dispose()
  })

  it('interpolates UV0 and UV1 at triangle hits', () => {
    const geometry = new Geometry({
      positions: new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      uvs1: new Float32Array([0.1, 0.2, 0.9, 0.2, 0.1, 0.8])
    })
    const mesh = new Mesh({ geometry, material: new BasicMaterial(), ownsResources: true })
    const scene = new Scene().add(mesh); scene.updateWorldMatrix()
    const raycaster = new Raycaster()
    raycaster.ray.set(new Vector3(-0.5, -0.5, 5), new Vector3(0, 0, -1))
    const hit = raycaster.intersectMesh(mesh)
    expect(hit?.uv?.x).toBeCloseTo(0.25)
    expect(hit?.uv?.y).toBeCloseTo(0.25)
    expect(hit?.uv1?.x).toBeCloseTo(0.3)
    expect(hit?.uv1?.y).toBeCloseTo(0.35)
    scene.dispose()
  })

})
