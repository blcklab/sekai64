import { createEngine, type SceneDefinition } from '@blcklab/sekai64'
import './style.css'

const definition = {
  version: 1,
  scene: {
    name: 'JSON Gallery',
    environment: { background: '#10121a' },
    camera: { type: 'perspective', position: [0, 1.3, 6], fieldOfView: 62 },
    objects: [
      { id: 'center', type: 'box', position: [0, 1.2, 0], size: [1.6, 1.6, 1.6], material: { baseColor: '#f2a7c2' } },
      { id: 'left', type: 'box', position: [-2.2, 0.8, -0.8], size: [1, 1, 1], material: { baseColor: '#9bd6bd' } },
      { id: 'right', type: 'box', position: [2.2, 0.8, -0.8], size: [1, 1, 1], material: { baseColor: '#f4d58d' } }
    ]
  }
} satisfies SceneDefinition

const canvas = document.querySelector<HTMLCanvasElement>('#world')
if (!canvas) throw new Error('Canvas not found.')
const engine = await createEngine({ canvas })
const loaded = await engine.loadScene(definition)
const center = loaded.get('center')

engine.start(({ deltaTime, elapsedTime }) => {
  if (center) center.rotation.y += deltaTime * 0.65
  if (Math.floor(elapsedTime) % 4 === 0 && center) center.position.y = 1.2 + Math.sin(elapsedTime * 2) * 0.15
  engine.render(loaded.scene, loaded.camera)
})

window.addEventListener('pagehide', () => { loaded.dispose(); engine.dispose() }, { once: true })
