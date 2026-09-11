import { BasicMaterial, Mesh, PerspectiveCamera, createEngine, createScene } from '@blcklab/sekai64'
import { AnimationClip, AnimationTrack, SkinnedGeometry, createAnimationRendererModule } from '@blcklab/sekai64/animation'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
if (!canvas) throw new Error('Canvas not found.')

const animation = createAnimationRendererModule()
const engine = await createEngine({ canvas, renderer: 'auto', antialias: true, modules: [animation] })
const scene = createScene({ name: 'Optional animation module' })
const camera = new PerspectiveCamera({ fieldOfView: 55, near: 0.1, far: 100 })
camera.position.set(0, 0, 4)

const geometry = new SkinnedGeometry({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
  morphTargets: [{ name: 'lift', positions: new Float32Array([0, 0, 0, 0, 0, 0, 0, 0.8, 0]) }],
})
const mesh = new Mesh({ id: 'animated-triangle', geometry, material: new BasicMaterial({ baseColor: '#8da2fb' }), ownsResources: true })
scene.add(mesh)
animation.bind(mesh)

const clip = new AnimationClip({
  id: 'float',
  tracks: [
    new AnimationTrack({ target: mesh.id, path: 'translation', times: new Float32Array([0, 1, 2]), values: new Float32Array([0, -0.25, 0, 0, 0.25, 0, 0, -0.25, 0]) }),
    new AnimationTrack({ target: mesh.id, path: 'weights', valueSize: 1, times: new Float32Array([0, 1, 2]), values: new Float32Array([0, 1, 0]) }),
  ],
})
animation.createMixer(scene, [clip]).play('float', { loop: 'repeat' })
engine.start(() => engine.render(scene, camera))

window.addEventListener('pagehide', () => { scene.dispose(); camera.dispose(); void engine.disposeAsync() }, { once: true })
