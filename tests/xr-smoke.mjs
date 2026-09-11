import assert from 'node:assert/strict'
import { XRSessionManager } from '@blcklab/sekai64/xr'

function matrix(x = 0, y = 0, z = 0) {
  const values = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1])
  const inverseValues = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1])
  const transform = { matrix: values }
  const inverse = { matrix: inverseValues }
  transform.inverse = inverse
  inverse.inverse = transform
  return transform
}

class ReferenceSpace extends EventTarget {}

class Session extends EventTarget {
  constructor({ failReferenceSpace = false, failReferenceSpaces = [] } = {}) {
    super()
    this.failReferenceSpace = failReferenceSpace
    this.failReferenceSpaces = new Set(failReferenceSpaces)
    this.requestedReferenceSpaces = []
    this.inputSources = []
    this.renderState = {}
    this.frames = new Map()
    this.nextFrame = 1
    this.ended = false
  }
  async requestReferenceSpace(type) {
    this.requestedReferenceSpaces.push(type)
    if (this.failReferenceSpace || this.failReferenceSpaces.has(type)) throw new Error('reference-space-failed')
    return new ReferenceSpace()
  }
  requestAnimationFrame(callback) {
    const id = this.nextFrame++
    this.frames.set(id, callback)
    return id
  }
  cancelAnimationFrame(id) { this.frames.delete(id) }
  updateRenderState(state) { Object.assign(this.renderState, state) }
  async end() {
    if (this.ended) return
    this.ended = true
    this.dispatchEvent(new Event('end'))
  }
  fire(time = 1000) {
    const callbacks = [...this.frames.values()]
    this.frames.clear()
    const view = {
      eye: 'left',
      projectionMatrix: matrix().matrix,
      transform: matrix(0.03, 1.65, 0),
    }
    const frame = {
      session: this,
      getViewerPose: () => ({ views: [view], transform: matrix(0, 1.65, 0) }),
      getPose: space => ({ transform: space.transform }),
    }
    for (const callback of callbacks) callback(time, frame)
  }
}

const originalNavigator = globalThis.navigator
const successfulSession = new Session()
const targetRaySpace = { transform: matrix(0.2, 1.2, -0.4) }
const gripSpace = { transform: matrix(0.1, 1.1, -0.3) }
const gamepad = {
  buttons: [
    { pressed: true, touched: true, value: 1 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: true, value: 0.25 },
    { pressed: false, touched: true, value: 0.5 },
  ],
  axes: [0.25, -0.5],
  vibrationActuator: {},
}
successfulSession.inputSources = [{
  handedness: 'right',
  targetRayMode: 'tracked-pointer',
  profiles: ['generic-trigger'],
  targetRaySpace,
  gripSpace,
  gamepad,
}]
let requested = successfulSession
let requestedSessionOptions = null
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    xr: {
      isSessionSupported: async mode => mode === 'immersive-vr',
      requestSession: async (_mode, options) => { requestedSessionOptions = options; return requested },
    },
  },
})

const manager = new XRSessionManager()
const states = []
manager.on('statechange', event => states.push(event.state))
assert.equal(await manager.checkSupport('immersive-vr'), true)
await manager.requestSession('immersive-vr')
assert.equal(manager.state, 'active')
assert.ok(requestedSessionOptions.optionalFeatures.includes('local-floor'))
manager.setPlayerRigTransform({ position: [5, 0, 2], yaw: 0 })
let frames = 0
manager.start(state => {
  frames += 1
  assert.equal(state.viewer.position[0], 5)
  assert.equal(state.viewer.position[1], 1.65)
  assert.equal(state.inputs[0].handedness, 'right')
  assert.equal(state.inputs[0].buttons[0].semantic, 'select')
  assert.equal(state.inputs[0].buttons[2].semantic, 'touchpad')
  assert.equal(state.inputs[0].buttons[3].semantic, 'thumbstick')
  assert.equal(state.inputs[0].supportsHaptics, true)
  assert.deepEqual(state.inputs[0].targetRay.position.map(value => Number(value.toFixed(2))), [5.2, 1.2, 1.6])
})
manager.start(() => { throw new Error('duplicate callback should replace, not duplicate loops') })
manager.start(state => {
  frames += 1
  assert.equal(state.views.length, 1)
})
successfulSession.fire()
assert.equal(frames, 1)
assert.equal(successfulSession.frames.size, 1)
await manager.end()
assert.equal(manager.state, 'idle')

const fallbackSession = new Session({ failReferenceSpaces: ['local-floor'] })
requested = fallbackSession
await manager.requestSession('immersive-vr')
assert.deepEqual(fallbackSession.requestedReferenceSpaces, ['local-floor', 'local'])
assert.equal(manager.referenceSpaceType, 'local')
await manager.end()

const failingSession = new Session({ failReferenceSpace: true })
requested = failingSession
await assert.rejects(manager.requestSession('immersive-vr'), /reference-space-failed/)
assert.equal(failingSession.ended, true)
assert.equal(manager.state, 'failed')
await manager.disposeAsync()
assert.equal(manager.state, 'disposed')
assert.ok(states.includes('entering'))
assert.ok(states.includes('active'))
assert.ok(states.includes('exiting'))
assert.ok(states.includes('failed'))

if (originalNavigator === undefined) delete globalThis.navigator
else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
console.log('Sekai64 XR lifecycle smoke tests passed.')
