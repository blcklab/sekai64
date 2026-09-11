import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  StandardMaterial,
  createEngine,
  createScene
} from '@blcklab/sekai64'
import { createBuilding, ImagePanel, ProductDisplay, TextPanel } from '@blcklab/sekai64/buildings'
import { CapsuleCharacterController, CollisionWorld } from '@blcklab/sekai64/collision'
import { FirstPersonControls } from '@blcklab/sekai64/controls'
import { InteractionManager } from '@blcklab/sekai64/interaction'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
const stats = document.querySelector<HTMLElement>('#stats')
if (!canvas || !stats) throw new Error('Example UI is incomplete.')

const engine = await createEngine({ canvas, renderer: 'auto', antialias: true, development: true })
engine.setClearColor('#10131a')
const scene = createScene({ name: 'Sekai64 virtual store' })
const camera = new PerspectiveCamera({ fieldOfView: 68, near: 0.05, far: 150 })
camera.position.set(0, 1.7, 6)

const store = createBuilding({
  id: 'store', width: 18, depth: 24, floorHeight: 4, wallThickness: 0.22,
  openings: [{ id: 'entrance', type: 'door', wall: 'front', position: 0, width: 2.4, height: 2.7 }],
  materials: { floor: '#363b44', wall: '#dfe4eb', ceiling: '#f5f7fa' }
})
scene.add(store)
scene.add(new AmbientLight({ id: 'ambient', color: '#dce7ff', intensity: 0.42 }))
scene.add(new DirectionalLight({ id: 'sun', color: '#fff1d6', intensity: 0.9, direction: [-0.4, -1, -0.3] }))

const title = new TextPanel('SEKAI64', { id: 'store-title', width: 5, height: 0.9, color: '#20242b' })
title.position.set(0, 2.7, -11.72)
scene.add(title)

const posterSource = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
    <rect width="900" height="1200" fill="#171b23"/>
    <circle cx="450" cy="390" r="220" fill="#8da2fb"/>
    <path d="M190 920 450 610 710 920Z" fill="#f0a6ca"/>
    <text x="450" y="1080" text-anchor="middle" font-family="system-ui" font-size="86" font-weight="700" fill="white">NEW WORLD</text>
  </svg>
`)}`
const poster = new ImagePanel(posterSource, { id: 'collection-poster', width: 2.7, height: 3.6 })
poster.position.set(-6.5, 2, -11.7)
scene.add(poster)
await poster.ready

const products: ProductDisplay[] = []
for (let row = 0; row < 2; row += 1) {
  for (let column = 0; column < 5; column += 1) {
    const index = row * 5 + column + 1
    const stand = new ProductDisplay(`product-${index}`, {
      id: `product-${index}`,
      width: 1.45, height: 1.05, depth: 1.1,
      color: row === 0 ? '#7289da' : '#d9829b',
      metadata: { name: `Collection item ${index}` }
    })
    stand.position.set(-5.6 + column * 2.8, 0.53, 1.8 - row * 6)
    scene.add(stand)
    products.push(stand)
  }
}

const counter = new Mesh({
  id: 'counter', tags: ['collision'],
  geometry: new BoxGeometry({ width: 5.2, height: 1.1, depth: 1.4 }),
  material: new StandardMaterial({ baseColor: '#7b5b47', roughness: 0.8 }),
  ownsResources: true
})
counter.position.set(0, 0.55, -8.7)
scene.add(counter)

scene.updateWorldMatrix()
const collisionWorld = new CollisionWorld(3)
collisionWorld.addScene(scene)
const character = new CapsuleCharacterController({ world: collisionWorld, height: 1.7, radius: 0.32, stepHeight: 0.28 })
const controls = new FirstPersonControls({ camera, target: window, movementSpeed: 4.2, collision: character })
const interactions = new InteractionManager({ scene, camera, element: canvas })

for (const product of products) {
  interactions.onObject(product, 'pointerenter', () => { canvas.style.cursor = 'pointer' })
  interactions.onObject(product, 'pointerleave', () => { canvas.style.cursor = 'crosshair' })
  interactions.onObject(product, 'click', () => {
    const name = String(product.metadata.name ?? product.productId)
    stats.textContent = `Selected: ${name}`
  })
}

canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) void canvas.requestPointerLock()
})
window.addEventListener('keydown', event => {
  if (event.code === 'Space') character.jump()
})

engine.start(({ deltaTime, frame }) => {
  controls.update(deltaTime)
  engine.render(scene, camera)
  if (frame % 15 === 0) stats.textContent = `${engine.capabilities.backend} · ${engine.stats.drawCalls} draws · ${Math.round(engine.stats.framesPerSecond)} FPS`
})

window.addEventListener('pagehide', () => {
  controls.dispose(); interactions.dispose(); scene.dispose(); camera.dispose(); engine.dispose()
}, { once: true })
