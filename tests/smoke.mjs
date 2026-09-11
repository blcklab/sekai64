import assert from 'node:assert/strict'
import {
  BasicMaterial,
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Geometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Scene,
  StandardMaterial,
  ImageMesh,
  PointLight,
  TextMesh,
  Texture,
  Vector2,
  Vector3,
  collectSceneLights,
  loadSceneDefinition
} from '@blcklab/sekai64'
import { AssetManager } from '@blcklab/sekai64/assets'
import { createBuilding } from '@blcklab/sekai64/buildings'
import { CapsuleCharacterController, CollisionWorld } from '@blcklab/sekai64/collision'
import { FirstPersonControls, InputState } from '@blcklab/sekai64/controls'
import { GltfLoader, loadModel } from '@blcklab/sekai64/gltf'
import { Raycaster } from '@blcklab/sekai64/interaction'
import { createRendererFeatures } from '@blcklab/sekai64/renderer'
import { toneMapColor } from '@blcklab/sekai64/postprocessing'
import { XRSessionManager, XRViewCamera, XRWebGLLayerBridge } from '@blcklab/sekai64/xr'

const scene = new Scene()
const cube = new Mesh({
  id: 'cube',
  geometry: new BoxGeometry(),
  material: new BasicMaterial({ baseColor: '#ff88aa' }),
  ownsResources: true
})
scene.add(cube)
cube.position.set(1, 2, 3)
scene.updateWorldMatrix()
assert.equal(scene.get('cube'), cube)
assert.equal(cube.worldMatrix.elements[12], 1)
assert.equal(cube.worldMatrix.elements[13], 2)


const cylinder = new CylinderGeometry({ radiusTop: 0.25, radiusBottom: 0.5, height: 2, radialSegments: 12 })
assert.ok(cylinder.triangleCount >= 48)
assert.equal(cylinder.bounds.min.y, -1)
assert.equal(cylinder.bounds.max.y, 1)
cylinder.dispose()

const ownedGeometryA = new BoxGeometry()
const ownedGeometryB = new BoxGeometry()
const ownedMaterialA = new BasicMaterial()
const ownedMaterialB = new BasicMaterial({ side: 'back', wireframe: true })
const replaceable = new Mesh({ geometry: ownedGeometryA, material: ownedMaterialA, ownsResources: true })
replaceable.setGeometry(ownedGeometryB, { ownsResource: true })
replaceable.setMaterial(ownedMaterialB, { ownsResource: true })
assert.equal(ownedGeometryA.disposed, true)
assert.equal(ownedMaterialA.disposed, true)
assert.equal(ownedMaterialB.side, 'back')
assert.equal(ownedMaterialB.wireframe, true)
replaceable.dispose()
assert.equal(ownedGeometryB.disposed, true)
assert.equal(ownedMaterialB.disposed, true)

const features = createRendererFeatures({ xr: true, wireframe: false })
assert.equal(features.trianglePicking, true)
assert.equal(features.xr, true)

const camera = new PerspectiveCamera({ aspect: 16 / 9 })
camera.position.z = 5
camera.updateMatrices()
assert.ok((camera.projectionMatrix.elements[0] ?? 0) > 0)

const hitScene = new Scene()
const hitCube = new Mesh({ geometry: new BoxGeometry(), material: new BasicMaterial() })
hitScene.add(hitCube)
hitScene.updateWorldMatrix()
const hitCamera = new PerspectiveCamera({ aspect: 1 })
hitCamera.position.z = 5
hitCamera.updateMatrices()
const hit = new Raycaster().setFromCamera(new Vector2(0, 0), hitCamera).intersectScene(hitScene, { firstHitOnly: true })[0]
assert.equal(hit?.object, hitCube)
assert.ok((hit?.distance ?? 0) > 0)


const triangleGeometry = new Geometry({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
})
const triangleMesh = new Mesh({ geometry: triangleGeometry, material: new BasicMaterial(), ownsResources: true })
const triangleScene = new Scene().add(triangleMesh)
triangleScene.updateWorldMatrix()
const precisionRaycaster = new Raycaster()
precisionRaycaster.ray.set(new Vector3(0.8, 0.8, 5), new Vector3(0, 0, -1))
assert.equal(Boolean(precisionRaycaster.intersectMesh(triangleMesh, 'bounds')), true)
assert.equal(precisionRaycaster.intersectMesh(triangleMesh, 'triangles'), null)
triangleScene.dispose()

const instanceGeometry = new BoxGeometry()
const instanceMaterial = new BasicMaterial()
const pickedInstances = new InstancedMesh({ geometry: instanceGeometry, material: instanceMaterial, count: 2, ownsResources: true })
const secondInstance = new Matrix4(); secondInstance.elements[12] = 3
pickedInstances.setMatrixAt(1, secondInstance)
const instanceScene = new Scene().add(pickedInstances)
instanceScene.updateWorldMatrix()
precisionRaycaster.ray.set(new Vector3(3, 0, 5), new Vector3(0, 0, -1))
const instanceHit = precisionRaycaster.intersectMesh(pickedInstances, 'triangles')
assert.equal(instanceHit?.instanceId, 1)
assert.ok(instanceHit?.triangleIndex !== undefined)
instanceScene.dispose()

const lightScene = new Scene()
const nearLight = new PointLight({ id: 'near', range: 5 }); nearLight.position.set(1, 0, 0)
const midLight = new PointLight({ id: 'mid', range: 5 }); midLight.position.set(2, 0, 0)
const farLight = new PointLight({ id: 'far', range: 5 }); farLight.position.set(10, 0, 0)
lightScene.add(farLight, midLight, nearLight); lightScene.updateWorldMatrix()
const lightSummary = collectSceneLights(lightScene, 2, new Vector3())
assert.equal(lightSummary.pointCount, 3)
assert.deepEqual(lightSummary.pointLights.map(item => item.source.id), ['near', 'mid'])
lightScene.dispose()

const loaded = await loadSceneDefinition({
  version: 2,
  variables: { accent: '#7799ff' },
  prefabs: { product: { type: 'box', size: [1, 2, 1], material: { type: 'standard', baseColor: '${accent}' } } },
  scene: { objects: [{ id: 'product', type: 'prefab', ref: 'product', position: [0, 1, 0] }] }
})
loaded.patch([{ op: 'replace', path: '/objects/product/position', value: [4, 5, 6] }])
await loaded.patchAsync([{ op: 'add', path: '/objects', value: { id: 'second', type: 'box' } }])
assert.equal(loaded.get('product')?.position.y, 5)
assert.equal(loaded.get('second')?.id, 'second')
assert.equal(loaded.serialize().scene.objects?.[0]?.position?.[2], 6)

const building = createBuilding({
  id: 'test-building', width: 12, depth: 14,
  openings: [{ type: 'door', wall: 'front', width: 2, height: 2.4 }]
})
const buildingScene = new Scene().add(building)
buildingScene.updateWorldMatrix()
assert.ok(buildingScene.findByTag('wall').length >= 4)
assert.equal(buildingScene.findByTag('building').length, 1)

const collisionWorld = new CollisionWorld(2)
collisionWorld.addBox({ id: 'floor', min: [-10, -0.2, -10], max: [10, 0, 10] })
collisionWorld.addBox({ id: 'wall', min: [0.9, 0, -1], max: [1.2, 3, 1] })
const character = new CapsuleCharacterController({ world: collisionWorld, height: 1.7, radius: 0.3 })
let characterPosition = character.move(new Vector3(0, 1.7, 0), new Vector3(), 1 / 60)
assert.equal(character.grounded, true)
characterPosition = character.move(characterPosition, new Vector3(2, 0, 0), 1 / 60)
assert.ok(characterPosition.x < 0.91)

const controlledCamera = new PerspectiveCamera()
controlledCamera.position.set(0, 1.7, 2)
const input = new InputState({})
input.keys.add('KeyW')
const firstPerson = new FirstPersonControls({ camera: controlledCamera, input, movementSpeed: 4 })
firstPerson.update(0.25)
assert.ok(controlledCamera.position.z < 2)
firstPerson.dispose(); input.dispose()


const previousOffscreenCanvas = globalThis.OffscreenCanvas
class FakeCanvasContext {
  font = ''
  fillStyle = ''
  textBaseline = 'middle'
  textAlign = 'center'
  measureText(value) { return { width: Math.max(1, String(value).length * 12) } }
  scale() {}
  clearRect() {}
  fillRect() {}
  fillText() {}
}
class FakeOffscreenCanvas {
  constructor(width, height) { this.width = width; this.height = height; this.context = new FakeCanvasContext() }
  getContext(type) { return type === '2d' ? this.context : null }
}
globalThis.OffscreenCanvas = FakeOffscreenCanvas
const textMesh = new TextMesh('Sekai64', { id: 'text', worldWidth: 2, fontSize: 32 })
assert.equal(textMesh.geometry.triangleCount, 2)
assert.equal(textMesh.texture.ready, true)
const firstTextTexture = textMesh.texture
textMesh.setText('World')
assert.equal(firstTextTexture.disposed, true)
const imageCanvas = new FakeOffscreenCanvas(200, 100)
const imageMesh = new ImageMesh(imageCanvas, { id: 'image', worldWidth: 4 })
assert.equal(imageMesh.texture.ready, true)
assert.equal(imageMesh.geometry.triangleCount, 2)
const previousImageGeometry = imageMesh.geometry
await imageMesh.setSource(new FakeOffscreenCanvas(100, 200))
assert.equal(previousImageGeometry.disposed, true)
assert.ok(imageMesh.geometry.bounds.max.y > imageMesh.geometry.bounds.max.x)
imageMesh.setTransform({ position: [2, 3, 4], rotation: [0, 1, 0], scale: [2, 2, 2] }).setVisible(false)
assert.equal(imageMesh.position.x, 2)
assert.equal(imageMesh.visible, false)
const visibilityScene = new Scene()
const visibilityParent = new Mesh({ geometry: new BoxGeometry(), material: new BasicMaterial(), ownsResources: true })
const visibilityChild = new Mesh({ geometry: new BoxGeometry(), material: new BasicMaterial(), ownsResources: true })
visibilityParent.add(visibilityChild); visibilityScene.add(visibilityParent); visibilityScene.updateWorldMatrix()
visibilityParent.visible = false; visibilityScene.updateWorldMatrix()
assert.equal(visibilityParent.worldVisible, false)
assert.equal(visibilityChild.worldVisible, false)
visibilityScene.dispose()
textMesh.dispose(); imageMesh.dispose()
if (previousOffscreenCanvas === undefined) delete globalThis.OffscreenCanvas
else globalThis.OffscreenCanvas = previousOffscreenCanvas

const unloadedTexture = new Texture({ source: 'data:image/png;base64,', label: 'unloaded' })
assert.equal(unloadedTexture.status, 'idle')
await assert.rejects(new Texture({ source: 'javascript:alert(1)' }).load(), /protocol/)
await assert.rejects(
  new Texture({ source: 'https://example.test/large.png' }).load({
    maxBytes: 2,
    fetch: async () => new Response(new Blob(['too large']), { status: 200 })
  }),
  /loading limit/
)
const standard = new StandardMaterial({ metallic: 2, roughness: -1, emissive: '#220000', baseColorTexture: unloadedTexture })
assert.equal(standard.metallic, 1)
assert.equal(standard.roughness, 0)
const instanced = new InstancedMesh({ geometry: new BoxGeometry(), material: standard, count: 2, ownsResources: true })
const translated = new Matrix4(); translated.elements[12] = 4
instanced.setMatrixAt(1, translated)
assert.ok(instanced.computeLocalBounds().max.x > 4)
instanced.dispose()

const assets = new AssetManager({ concurrency: 2 })
const textA = await assets.loadText('data:text/plain,Sekai64')
const textB = await assets.loadText('data:text/plain,Sekai64')
assert.equal(textA.value, 'Sekai64')
assert.equal(assets.stats.entries, 1)
assert.equal(assets.stats.references, 2)
textA.dispose(); textB.dispose(); assets.clearUnused(); assert.equal(assets.stats.entries, 0)

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
const binary = Buffer.from(positions.buffer).toString('base64')
const gltfDocument = {
  asset: { version: '2.0' },
  buffers: [{ uri: `data:application/octet-stream;base64,${binary}`, byteLength: positions.byteLength }],
  bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0 }],
  scenes: [{ nodes: [0] }],
  scene: 0
}
const gltfUri = `data:model/gltf+json,${encodeURIComponent(JSON.stringify(gltfDocument))}`
const gltfLoader = new GltfLoader()
const gltf = await gltfLoader.load(gltfUri)
assert.equal(gltf.scene.findByTag('gltf-mesh').length, 1)
gltf.dispose(); gltfLoader.dispose()
const model = await loadModel(gltfUri)
assert.equal(model.findByTag('gltf-mesh').length, 1)
model.dispose()

const mapped = toneMapColor([4, 1, 0.2], 'aces', 1)
assert.ok(mapped.every(value => value >= 0 && value <= 1))
assert.equal(await XRSessionManager.isSupported('immersive-vr'), false)

const previousLayer = globalThis.XRWebGLLayer
globalThis.XRWebGLLayer = class {
  framebuffer = null
  constructor(session) { this.session = session }
  getViewport() { return { x: 0, y: 0, width: 10, height: 10 } }
}
let compatible = false
const renderCalls = []
const fakeRenderer = {
  getContext: () => ({}),
  makeXRCompatible: async () => { compatible = true },
  renderViewport: (_scene, _camera, viewport, options) => renderCalls.push({ viewport, options })
}
const fakeSession = {
  renderState: {}, inputSources: [],
  updateRenderState(state) { Object.assign(this.renderState, state) }
}
const bridge = new XRWebGLLayerBridge(fakeRenderer)
await bridge.initialize(fakeSession)
const left = new XRViewCamera('left'), right = new XRViewCamera('right')
left.viewport = { x: 0, y: 0, width: 10, height: 10 }; right.viewport = { x: 10, y: 0, width: 10, height: 10 }
bridge.render(hitScene, { session: fakeSession, views: [left, right] })
assert.equal(compatible, true)
assert.equal(renderCalls.length, 2)
assert.equal(renderCalls[0].options.clear, true)
assert.equal(renderCalls[1].options.clear, false)
bridge.dispose()
if (previousLayer === undefined) delete globalThis.XRWebGLLayer
else globalThis.XRWebGLLayer = previousLayer

loaded.dispose(); scene.dispose(); hitScene.dispose(); buildingScene.dispose(); camera.dispose(); hitCamera.dispose(); controlledCamera.dispose(); assets.dispose()
assert.equal(cube.geometry.disposed, true)
assert.equal(cube.material.disposed, true)
assert.ok(new Box3(new Vector3(0,0,0), new Vector3(1,1,1)).containsPoint(new Vector3(0.5,0.5,0.5)))
unloadedTexture.dispose()
console.log('Sekai64 smoke tests passed.')
