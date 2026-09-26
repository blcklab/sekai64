import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { createProceduralSky } from '../dist/environment-authoring/index.js'
import { PerspectiveCamera } from '../dist/cameras/index.js'
import { Matrix4 } from '../dist/math/index.js'

const nightOptions = {
  width: 256,
  height: 128,
  zenithColor: [0.0015, 0.003, 0.012],
  horizonColor: [0.008, 0.012, 0.025],
  groundColor: [0.001, 0.001, 0.002],
  sunIntensity: 0,
  cloudCoverage: 0,
  starDensity: 0.58,
  starIntensity: 4.5,
  starBrightnessVariation: 0.7,
  starSizeVariation: 0.6,
  starColorTemperatureVariation: 0.45,
  starSeed: 8127,
}

test('Step 9 procedural stars are deterministic, seeded, upper-hemisphere environment data', () => {
  const first = createProceduralSky(nightOptions)
  const second = createProceduralSky(nightOptions)
  const changed = createProceduralSky({ ...nightOptions, starSeed: 8128 })
  assert.deepEqual(first.pixels, second.pixels)
  assert.notDeepEqual(first.pixels, changed.pixels)

  const base = createProceduralSky({ ...nightOptions, starDensity: 0 })
  let upperDelta = 0
  let lowerDelta = 0
  let peak = 0
  for (let y = 0; y < first.height; y += 1) {
    for (let x = 0; x < first.width; x += 1) {
      const offset = (y * first.width + x) * 3
      const delta = Math.abs(first.pixels[offset] - base.pixels[offset]) + Math.abs(first.pixels[offset + 1] - base.pixels[offset + 1]) + Math.abs(first.pixels[offset + 2] - base.pixels[offset + 2])
      if (y < first.height / 2) upperDelta += delta
      else lowerDelta += delta
      peak = Math.max(peak, first.pixels[offset], first.pixels[offset + 1], first.pixels[offset + 2])
    }
  }
  assert.ok(upperDelta > 1)
  assert.equal(lowerDelta, 0)
  assert.ok(peak > 1, 'bright stars retain HDR energy before LDR conversion')
  first.dispose(); second.dispose(); changed.dispose(); base.dispose()
})

test('Step 9 star density and temperature/size variation stay bounded authoring inputs', () => {
  const sparse = createProceduralSky({ ...nightOptions, starDensity: 0.08, starIntensity: 2 })
  const dense = createProceduralSky({ ...nightOptions, starDensity: 0.9, starIntensity: 2 })
  const base = createProceduralSky({ ...nightOptions, starDensity: 0 })
  const energy = resource => resource.pixels.reduce((sum, value, index) => sum + Math.max(0, value - base.pixels[index]), 0)
  assert.ok(energy(dense) > energy(sparse))
  sparse.dispose(); dense.dispose(); base.dispose()
})

test('Step 9 environment background is one camera-stable draw path in both backends', async () => {
  const [rendererContract, webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer/src/Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])
  assert.match(rendererContract, /background\?: boolean/)
  assert.match(rendererContract, /backgroundIntensity\?: number/)
  for (const source of [webgl, webgpu]) {
    assert.match(source, /drawEnvironmentBackground/)
    assert.match(source, /inverseViewProjection/)
    assert.match(source, /cameraPosition/)
    assert.match(source, /environment\.rotation/)
    assert.doesNotMatch(source, /StarSystem|StarRenderer|StarEntity/)
  }
  assert.match(webgl, /gl\.drawArrays\(gl\.TRIANGLES, 0, 3\)/)
  assert.match(webgpu, /pass\.draw\(3\)/)
})

test('Step 9 procedural sky generation remains bounded at representative resolution', () => {
  const started = performance.now()
  const sky = createProceduralSky({ ...nightOptions, width: 512, height: 256, starDensity: 1 })
  const elapsed = performance.now() - started
  assert.equal(sky.pixels.length, 512 * 256 * 3)
  assert.ok(elapsed < 5000, `procedural night sky generation took ${elapsed.toFixed(1)}ms`)
  sky.dispose()
})


const reconstructDirection = (camera, ndcX, ndcY) => {
  camera.updateMatrices()
  const inverse = new Matrix4().copy(camera.viewProjectionMatrix).invert().elements
  const x = ndcX, y = ndcY, z = 1, w = 1
  const px = (inverse[0] * x + inverse[4] * y + inverse[8] * z + inverse[12] * w)
  const py = (inverse[1] * x + inverse[5] * y + inverse[9] * z + inverse[13] * w)
  const pz = (inverse[2] * x + inverse[6] * y + inverse[10] * z + inverse[14] * w)
  const pw = (inverse[3] * x + inverse[7] * y + inverse[11] * z + inverse[15] * w)
  const worldX = px / pw, worldY = py / pw, worldZ = pz / pw
  const e = camera.worldMatrix.elements
  let dx = worldX - e[12], dy = worldY - e[13], dz = worldZ - e[14]
  const length = Math.hypot(dx, dy, dz)
  dx /= length; dy /= length; dz /= length
  return [dx, dy, dz]
}

test('Step 9 environment ray reconstruction is invariant to camera translation', () => {
  const first = new PerspectiveCamera({ fieldOfView: 63, aspect: 16 / 9, autoAspect: false })
  const second = new PerspectiveCamera({ fieldOfView: 63, aspect: 16 / 9, autoAspect: false })
  first.setViewAngles(-0.18, 0.72, 0)
  second.setViewAngles(-0.18, 0.72, 0)
  first.position.set(0, 1.7, 0)
  second.position.set(145, -23, 88)
  for (const sample of [[0, 0], [-0.7, 0.4], [0.55, -0.3]]) {
    const a = reconstructDirection(first, sample[0], sample[1])
    const b = reconstructDirection(second, sample[0], sample[1])
    for (let i = 0; i < 3; i += 1) assert.ok(Math.abs(a[i] - b[i]) < 2e-5, `ray component ${i} drifted under translation`)
  }
})
