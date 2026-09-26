import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BasicMaterial, Matrix4, ParticleEmitter, PlaneGeometry } from '../dist/index.js'

class CameraStub {
  worldMatrix = new Matrix4()
  constructor(x = 0, y = 0, z = 0) {
    this.worldMatrix.elements[12] = x
    this.worldMatrix.elements[13] = y
    this.worldMatrix.elements[14] = z
  }
  updateWorldFromRoot() {}
}

function createEmitter(overrides = {}) {
  const geometry = new PlaneGeometry()
  const material = new BasicMaterial({ transparent: true, doubleSided: true })
  const emitter = new ParticleEmitter({
    geometry,
    material,
    seed: 99,
    maxParticles: 32,
    burst: 1,
    lifetime: { min: 2, max: 2 },
    size: { min: 0.2, max: 0.2 },
    opacity: { min: 1, max: 1 },
    quality: 'ultra',
    ...overrides,
  })
  return { emitter, geometry, material }
}

function dispose(setup) {
  setup.emitter.dispose()
  setup.geometry.dispose()
  setup.material.dispose()
}

function axisLength(matrix, offset) {
  const e = matrix.elements
  return Math.hypot(e[offset] ?? 0, e[offset + 1] ?? 0, e[offset + 2] ?? 0)
}

test('Step 5 normalized lifetime ramps drive billboard size, opacity, color, and rotation', () => {
  const setup = createEmitter({
    sizeOverLife: { start: 0.2, end: 1.0 },
    opacityOverLife: { start: 1, end: 0 },
    rotationOverLife: { start: 0, end: Math.PI },
    colorOverLife: { start: [1, 0, 0], end: [0, 0, 1] },
  })
  const camera = new CameraStub()
  setup.emitter.update(0, camera)
  for (let i = 0; i < 4; i += 1) setup.emitter.update(0.25, camera)

  const color = setup.emitter.getColorAt(0)
  assert.ok(Math.abs(color[0] - 0.5) < 1e-5)
  assert.ok(Math.abs(color[1] - 0) < 1e-5)
  assert.ok(Math.abs(color[2] - 0.5) < 1e-5)
  assert.ok(Math.abs(color[3] - 0.5) < 1e-5)

  const matrix = setup.emitter.getMatrixAt(0)
  assert.ok(Math.abs(axisLength(matrix, 0) - 0.6) < 1e-5)
  assert.ok(Math.abs(axisLength(matrix, 4) - 0.6) < 1e-5)
  assert.ok(Math.abs(matrix.elements[0] ?? 0) < 1e-5, 'half-life rotation should turn the billboard by PI/2 in local basis')
  assert.ok(Math.abs(matrix.elements[1] ?? 0) > 0.5, 'rotation should move the billboard right axis into the up axis')
  dispose(setup)
})

test('Step 5 renderer-owned distance policy reduces density smoothly and culls very distant emitters', () => {
  const near = createEmitter({ maxParticles: 100, burst: 100, importance: 1 })
  near.emitter.update(0, new CameraStub(0, 0, 0))
  const nearBudget = near.emitter.budgetParticles
  assert.equal(nearBudget, 100)

  const medium = createEmitter({ maxParticles: 100, burst: 100, importance: 1 })
  medium.emitter.update(0, new CameraStub(120, 0, 0))
  assert.ok(medium.emitter.budgetParticles > 0)
  assert.ok(medium.emitter.budgetParticles < nearBudget)

  const far = createEmitter({ maxParticles: 100, burst: 100, importance: 1 })
  far.emitter.update(0, new CameraStub(1000, 0, 0))
  assert.equal(far.emitter.budgetParticles, 0)
  assert.equal(far.emitter.drawCount, 0)
  dispose(near); dispose(medium); dispose(far)
})

test('Step 5 instanced RGBA is persistent on WebGL2 and WebGPU instead of allocating per particle', async () => {
  const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
  const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
  assert.match(webgl, /layout\(location=10\) in vec4 a_instanceColor/)
  assert.match(webgl, /bufferSubData\(gl\.ARRAY_BUFFER, 0, mesh\.instanceColors\)/)
  assert.match(webgpu, /@location\(10\) instanceColor:vec4<f32>/)
  assert.match(webgpu, /queue\.writeBuffer\(state\.colorBuffer, 0, mesh\.instanceColors\)/)
  assert.doesNotMatch(webgl, /new (?:Array|Float32Array)\([^\n]*activeParticles/)
  assert.doesNotMatch(webgpu, /new (?:Array|Float32Array)\([^\n]*activeParticles/)
})
