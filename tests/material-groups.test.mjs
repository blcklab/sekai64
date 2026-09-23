import assert from 'node:assert/strict'
import { PerspectiveCamera } from '../dist/cameras/index.js'
import { Geometry } from '../dist/geometry/index.js'
import { BasicMaterial } from '../dist/materials/index.js'
import { RenderQueueBuilder } from '../dist/renderer/index.js'
import { Mesh, Scene } from '../dist/scene/index.js'

const geometry = new Geometry({
  positions: new Float32Array([
    -1,-1,0, 0,-1,0, -1,1,0,
     0,-1,0, 1,-1,0,  1,1,0,
  ]),
  indices: new Uint16Array([0,1,2, 3,4,5]),
  groups: [
    { start: 0, count: 3, materialIndex: 0, name: 'left' },
    { start: 3, count: 3, materialIndex: 1, name: 'right' },
  ],
})
assert.equal(geometry.groups.length, 2)
assert.throws(() => new Geometry({
  positions: new Float32Array([-1,-1,0, 1,-1,0, 0,1,0]),
  indices: new Uint16Array([0,1,2]),
  groups: [{ start: 1, count: 3, materialIndex: 0 }],
}), /triangle-aligned/)

const opaque = new BasicMaterial({ label: 'opaque' })
const transparent = new BasicMaterial({ label: 'transparent', transparent: true })
const mesh = new Mesh({ geometry, materials: [opaque, transparent] })
assert.equal(mesh.material, opaque)
assert.equal(mesh.materialAt(1), transparent)

const scene = new Scene()
scene.add(mesh)
const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 1, near: 0.1, far: 100 })
camera.position.set(0,0,5)
camera.lookAt([0,0,0])
camera.updateMatrices()
scene.updateWorldMatrix()
const queue = new RenderQueueBuilder().build(scene, camera, { frustumCulling: false })
assert.equal(queue.opaque.length, 1)
assert.equal(queue.transparent.length, 1)
assert.deepEqual([queue.opaque[0].start, queue.opaque[0].count, queue.opaque[0].groupName], [0,3,'left'])
assert.equal(queue.opaque[0].material, opaque)
assert.deepEqual([queue.transparent[0].start, queue.transparent[0].count, queue.transparent[0].groupName], [3,3,'right'])
assert.equal(queue.transparent[0].material, transparent)

const shadow = new RenderQueueBuilder().buildShadowCasters(scene)
assert.equal(shadow.length, 1)
assert.equal(shadow[0].groupName, 'left')

mesh.setMaterialGroupSlots({ left: 1, right: 0 })
const swapped = new RenderQueueBuilder().build(scene, camera, { frustumCulling: false })
assert.equal(swapped.opaque[0].groupName, 'right')
assert.equal(swapped.transparent[0].groupName, 'left')

const replacement = new BasicMaterial({ label: 'replacement' })
mesh.setMaterials([replacement, transparent], { disposePrevious: false, ownsResource: false })
assert.equal(mesh.material, replacement)
assert.equal(opaque.disposed, false)

scene.dispose(); geometry.dispose(); opaque.dispose(); transparent.dispose(); replacement.dispose()
console.log('Sekai64 material groups: PASS')
