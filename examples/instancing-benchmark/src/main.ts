import { AmbientLight, BoxGeometry, DirectionalLight, Euler, InstancedMesh, Matrix4, PerspectiveCamera, StandardMaterial, Vector3, createEngine, createScene } from '@blcklab/sekai64'
import { OrbitControls } from '@blcklab/sekai64/controls'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
const stats = document.querySelector<HTMLElement>('#stats')
if (!canvas || !stats) throw new Error('Example UI is incomplete.')
const engine = await createEngine({ canvas, renderer: 'auto', antialias: true })
const scene = createScene({ name: 'Instancing benchmark' })
const camera = new PerspectiveCamera({ fieldOfView: 58, near: 0.1, far: 300 })
camera.position.set(32, 24, 38)
const controls = new OrbitControls({ camera, target: [0, 0, 0], eventTarget: canvas, damping: 0.12 })
scene.add(new AmbientLight({ intensity: 0.35 }))
scene.add(new DirectionalLight({ intensity: 1.1, direction: [-1, -2, -1] }))

const side = 28
const count = side * side
const instances = new InstancedMesh({
  id: 'cube-field', count,
  geometry: new BoxGeometry({ width: 0.72, height: 0.72, depth: 0.72 }),
  material: new StandardMaterial({ baseColor: '#8ca4ff', roughness: 0.5 }),
  ownsResources: true
})
const matrix = new Matrix4(), position = new Vector3(), rotation = new Euler(), scale = new Vector3(1, 1, 1)
for (let z = 0; z < side; z += 1) for (let x = 0; x < side; x += 1) {
  const index = z * side + x
  position.set((x - side / 2) * 1.15, Math.sin(x * 0.45) * Math.cos(z * 0.35), (z - side / 2) * 1.15)
  rotation.set(0, (x + z) * 0.08, 0)
  instances.setMatrixAt(index, matrix.compose(position, rotation, scale))
}
scene.add(instances)
engine.setClearColor('#080b13')
engine.start(({ deltaTime, frame }) => {
  controls.update(deltaTime)
  instances.rotation.y += deltaTime * 0.06
  engine.render(scene, camera)
  if (frame % 12 === 0) stats.textContent = `${count.toLocaleString()} cubes · ${engine.stats.drawCalls} draw · ${engine.stats.triangles.toLocaleString()} triangles · ${Math.round(engine.stats.framesPerSecond)} FPS · ${engine.capabilities.backend}`
})
window.addEventListener('pagehide', () => { controls.dispose(); scene.dispose(); camera.dispose(); engine.dispose() }, { once: true })
