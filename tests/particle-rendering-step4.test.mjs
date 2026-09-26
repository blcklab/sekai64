import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BasicMaterial, Matrix4, ParticleEmitter, PlaneGeometry } from '../dist/index.js'

class CameraStub {
  worldMatrix = new Matrix4()
  updateWorldFromRoot() {}
}

function makeEmitter(overrides = {}) {
  const geometry = new PlaneGeometry()
  const material = new BasicMaterial({ transparent: true, doubleSided: true })
  const emitter = new ParticleEmitter({
    geometry,
    material,
    seed: 8127,
    maxParticles: 64,
    emissionRate: 0,
    burst: 12,
    lifetime: { min: 2, max: 4 },
    spawnShape: { type: 'box', size: [5, 1, 5] },
    velocity: { min: [-0.2, 0.3, -0.2], max: [0.2, 1, 0.2] },
    acceleration: [0, 0, 0],
    gravity: [0, -0.1, 0],
    drag: 0.05,
    size: { min: 0.02, max: 0.08 },
    opacity: { min: 0.25, max: 0.8 },
    rotation: { min: -0.4, max: 0.4 },
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

test('Step 4 deterministic particle state is typed-array backed and reproducible', () => {
  const a = makeEmitter()
  const b = makeEmitter()
  const camera = new CameraStub()
  a.emitter.update(0, camera)
  b.emitter.update(0, camera)
  assert.equal(a.emitter.activeParticles, 12)
  assert.equal(a.emitter.drawCount, 12)
  assert.ok(a.emitter.positions instanceof Float32Array)
  assert.ok(a.emitter.velocities instanceof Float32Array)
  assert.deepEqual([...a.emitter.positions.slice(0, 36)], [...b.emitter.positions.slice(0, 36)])
  assert.deepEqual([...a.emitter.velocities.slice(0, 36)], [...b.emitter.velocities.slice(0, 36)])
  assert.deepEqual([...a.emitter.lifetimes.slice(0, 12)], [...b.emitter.lifetimes.slice(0, 12)])
  dispose(a); dispose(b)
})

test('Step 4 realizes all generic spawn shapes without semantic effect branches', () => {
  const camera = new CameraStub()
  for (const spawnShape of [
    { type: 'point' },
    { type: 'box', size: [2, 3, 4] },
    { type: 'sphere', radius: 2 },
    { type: 'surface', size: [3, 1, 5] },
  ]) {
    const setup = makeEmitter({ spawnShape, burst: 4 })
    setup.emitter.update(0, camera)
    assert.equal(setup.emitter.activeParticles, 4)
    dispose(setup)
  }
})

test('Step 4 quality policy reduces active GPU instance budget while retaining authored capacity', () => {
  const setup = makeEmitter({ maxParticles: 100, burst: 100, quality: 'low', importance: 0.5 })
  setup.emitter.update(0, new CameraStub())
  assert.equal(setup.emitter.count, 100)
  assert.equal(setup.emitter.drawCount, setup.emitter.budgetParticles)
  assert.ok(setup.emitter.drawCount < setup.emitter.count)
  setup.emitter.quality = 'ultra'
  assert.ok(setup.emitter.budgetParticles > setup.emitter.drawCount)
  dispose(setup)
})

test('Step 4 WebGL2 and WebGPU instanced paths draw InstancedMesh.drawCount rather than full capacity', async () => {
  const webgl = await readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8')
  const webgpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')
  assert.match(webgl, /mesh\.drawCount/)
  assert.match(webgl, /if \(instanceCount <= 0\) return/)
  assert.match(webgl, /bufferSubData\(gl\.ARRAY_BUFFER, 0, mesh\.instanceMatrices\)/)
  assert.match(webgpu, /mesh\.drawCount/)
  assert.match(webgpu, /GPUBufferUsage\.VERTEX \| GPUBufferUsage\.COPY_DST/)
  assert.match(webgpu, /queue\.writeBuffer\(state\.matrixBuffer, 0, mesh\.instanceMatrices\)/)
  const getInstancesBody = webgpu.slice(webgpu.indexOf('private getInstances'), webgpu.indexOf('private getTexture'))
  assert.doesNotMatch(getInstancesBody, /state\.(?:matrixBuffer|colorBuffer)\.destroy\(\)/)
  for (const source of [webgl, webgpu]) {
    assert.doesNotMatch(source, /RainSystem|SnowSystem|FireSystem|SmokeSystem|DustSystem|FireflySystem/)
  }
})
