import { BasicMaterial, BoxGeometry, Mesh, PerspectiveCamera, createEngine, createScene } from '@blcklab/sekai64'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
if (!canvas) throw new Error('Canvas not found.')

const engine = await createEngine({ canvas, renderer: 'auto', antialias: true })
const scene = createScene({ name: 'Basic cube' })
const camera = new PerspectiveCamera({ fieldOfView: 60, near: 0.1, far: 100 })
camera.position.set(0, 0, 4)

const cube = new Mesh({
  id: 'cube',
  geometry: new BoxGeometry({ width: 1.5, height: 1.5, depth: 1.5 }),
  material: new BasicMaterial({ baseColor: '#8da2fb' }),
  ownsResources: true
})
scene.add(cube)

document.querySelector('#backend')!.textContent = engine.capabilities.backend
engine.start(({ deltaTime }) => {
  cube.rotation.x += deltaTime * 0.35
  cube.rotation.y += deltaTime * 0.7
  engine.render(scene, camera)
})

window.addEventListener('pagehide', () => {
  scene.dispose()
  camera.dispose()
  engine.dispose()
}, { once: true })
