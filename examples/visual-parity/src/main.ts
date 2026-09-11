import {
  AmbientLight,
  CylinderGeometry,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  StandardMaterial,
  createEngine,
  createScene,
} from '@blcklab/sekai64'
import { BeveledBoxGeometry } from '@blcklab/sekai64/geometry/beveled-box'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
if (!canvas) throw new Error('Canvas not found.')
const requested = new URLSearchParams(location.search).get('backend')
const renderer = requested === 'webgl2' || requested === 'webgpu' ? requested : 'auto'
const engine = await createEngine({
  canvas,
  renderer,
  antialias: true,
  colorManagement: { toneMapping: 'aces', exposure: 1, outputColorSpace: 'srgb' },
  environmentLighting: { enabled: true, skyColor: [0.18, 0.24, 0.34], groundColor: [0.018, 0.022, 0.03], intensity: 0.32, specularIntensity: 0.3 },
  shadows: { enabled: true, mapSize: 2048, softness: 1, normalBias: 0.018 },
  imageQuality: { dithering: true, maxAnisotropy: 8 },
})
engine.setClearColor('#070a10')
const scene = createScene({ name: 'S1–S7 visual parity' })
const camera = new PerspectiveCamera({ fieldOfView: 52, near: 0.1, far: 100 })
camera.position.set(7.5, 4.5, 10)
camera.rotation.set(-0.25, 0.62, 0)

const ambient = new AmbientLight({ color: '#b8c7db', intensity: 0.12 })
const sun = new DirectionalLight({ color: '#fff3dd', intensity: 3.2, direction: [-0.55, -1, -0.35] })
sun.castShadow = true
scene.add(ambient, sun)

const floor = new Mesh({ geometry: new PlaneGeometry({ width: 18, height: 14 }), material: new StandardMaterial({ baseColor: '#1b2028', metallic: 0.05, roughness: 0.72 }), ownsResources: true })
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const swatches = [
  { color: '#9aa5b4', metallic: 1, roughness: 0.16 },
  { color: '#707a86', metallic: 1, roughness: 0.62 },
  { color: '#1c4a58', metallic: 0, roughness: 0.25 },
  { color: '#873d2f', metallic: 0, roughness: 0.82 },
]
for (let index = 0; index < swatches.length; index += 1) {
  const item = swatches[index]!
  const mesh = new Mesh({ geometry: new BeveledBoxGeometry({ width: 1.7, height: 1.7, depth: 1.7, bevelRadius: 0.12, bevelSegments: 3 }), material: new StandardMaterial({ baseColor: item.color, metallic: item.metallic, roughness: item.roughness }), ownsResources: true })
  mesh.position.set(-3.15 + index * 2.1, 0.88, 0)
  scene.add(mesh)
}
const glassColor = Color.from('#9eddf2'); glassColor.a = 0.24
const glass = new Mesh({ geometry: new CylinderGeometry({ radiusTop: 1, radiusBottom: 1, height: 2.7, radialSegments: 48 }), material: new StandardMaterial({ baseColor: glassColor, metallic: 0, roughness: 0.08, transmission: 0.9, ior: 1.5, thickness: 0.08, attenuationColor: '#72c5dd', attenuationDistance: 2.5, alphaMode: 'blend', transparent: true, side: 'double' }), ownsResources: true })
glass.position.set(0, 1.4, -3.1)
scene.add(glass)

document.querySelector('#backend')!.textContent = engine.capabilities.backend
engine.start(({ elapsedTime }) => {
  for (const [index, child] of scene.children.entries()) if (child instanceof Mesh && child !== floor) child.rotation.y = elapsedTime * (0.08 + index * 0.012)
  engine.render(scene, camera)
})
window.addEventListener('pagehide', () => { scene.dispose(); camera.dispose(); void engine.disposeAsync() }, { once: true })
