import { AmbientLight, BoxGeometry, DirectionalLight, Mesh, PerspectiveCamera, StandardMaterial, createEngine, createScene } from '@blcklab/sekai64'
import { WebGL2Renderer } from '@blcklab/sekai64/renderers/webgl2'
import { XRSessionManager, XRWebGLLayerBridge, type XRMode } from '@blcklab/sekai64/xr'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#world')
const statusNode = document.querySelector<HTMLElement>('#status')
const vrButton = document.querySelector<HTMLButtonElement>('#vr')
const arButton = document.querySelector<HTMLButtonElement>('#ar')
if (!canvas || !statusNode || !vrButton || !arButton) throw new Error('Example UI is incomplete.')

// WebXR rendering uses Sekai64's explicit WebGL2 bridge in v0.7.0-rc.1.
const status = statusNode
const engine = await createEngine({ canvas, renderer: 'webgl2', antialias: true, alpha: true })
const renderer = engine.renderer
if (!(renderer instanceof WebGL2Renderer)) throw new Error('The WebXR example requires the WebGL2 renderer.')
const scene = createScene({ name: 'WebXR room' })
const camera = new PerspectiveCamera({ fieldOfView: 65, near: 0.05, far: 100 })
camera.position.set(0, 1.6, 4)
scene.add(new AmbientLight({ intensity: 0.45 }))
scene.add(new DirectionalLight({ intensity: 1, direction: [-0.6, -1, -0.4] }))
for (let i = 0; i < 9; i += 1) {
  const cube = new Mesh({
    id: `cube-${i}`,
    geometry: new BoxGeometry({ width: 0.55, height: 0.55, depth: 0.55 }),
    material: new StandardMaterial({ baseColor: i % 2 ? '#e087a8' : '#7896ec', roughness: 0.55 }),
    ownsResources: true
  })
  cube.position.set((i % 3 - 1) * 1.2, 0.5 + Math.floor(i / 3) * 0.9, -2.2)
  scene.add(cube)
}

const xr = new XRSessionManager()
const bridge = new XRWebGLLayerBridge(renderer)
let desktopRunning = false
function startDesktop(): void {
  if (desktopRunning) return
  desktopRunning = true
  engine.start(({ deltaTime }) => {
    scene.rotation.y += deltaTime * 0.08
    engine.render(scene, camera)
  })
}
function stopDesktop(): void { desktopRunning = false; engine.stop() }
startDesktop()

const [vrSupported, arSupported] = await Promise.all([
  XRSessionManager.isSupported('immersive-vr'),
  XRSessionManager.isSupported('immersive-ar')
])
vrButton.disabled = !vrSupported
arButton.disabled = !arSupported
status.textContent = vrSupported || arSupported ? 'Choose an available spatial mode.' : 'Immersive WebXR is unavailable on this device/browser.'

async function enter(mode: XRMode): Promise<void> {
  try {
    stopDesktop()
    status.textContent = `Starting ${mode}…`
    const ar = mode === 'immersive-ar'
    const session = await xr.requestSession(mode, {
      referenceSpace: ar ? 'local' : 'local-floor',
      requiredFeatures: ar ? ['hit-test'] : [],
      optionalFeatures: ['dom-overlay'],
      domOverlayRoot: document.body
    })
    await bridge.initialize(session, { alpha: ar, antialias: true, depthNear: 0.05, depthFar: 100 })
    if (ar) await xr.enableHitTesting()
    xr.start(state => bridge.render(scene, state))
    status.textContent = ar ? 'AR running — move the device to find surfaces.' : 'VR running.'
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
    startDesktop()
  }
}
vrButton.addEventListener('click', () => void enter('immersive-vr'))
arButton.addEventListener('click', () => void enter('immersive-ar'))
xr.on('sessionend', () => { status.textContent = 'XR session ended.'; startDesktop() })
window.addEventListener('pagehide', () => { bridge.dispose(); xr.dispose(); scene.dispose(); camera.dispose(); engine.dispose() }, { once: true })
