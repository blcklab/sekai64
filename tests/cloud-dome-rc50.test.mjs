import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [webgl, webgpu] = await Promise.all([
  readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
])

function cloudDomeCoordinate([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1
  x /= length; y /= length; z /= length
  const horizontal = Math.hypot(x, z)
  const theta = Math.acos(Math.max(0, Math.min(1, y)))
  if (horizontal <= 1e-6 || theta <= 1e-6) return [0, 0]
  const radius = (theta / (0.5 * Math.PI)) * 0.45
  return [x / horizontal * radius, z / horizontal * radius]
}

test('rc50 dynamic clouds use a seam-free upper-dome coordinate instead of longitude UVs', () => {
  for (const source of [webgl, webgpu]) {
    assert.match(source, /cloudDomeCoordinate/)
    assert.doesNotMatch(source, /skyUv=environmentUv\(direction\)/)
    assert.match(source, /cloudDomeCoordinate\(direction(?:,[^)]*)?\).*cloudParams\.w|cloudDomeCoordinate\(direction(?:,[^)]*)?\)\*u_cloudParams\.w/s)
  }
})

test('rc50 cloud dome collapses every azimuth continuously to one zenith coordinate', () => {
  const exactZenith = cloudDomeCoordinate([0, 1, 0])
  assert.deepEqual(exactZenith, [0, 0])
  const epsilon = 1e-5
  const samples = [
    cloudDomeCoordinate([epsilon, 1, 0]),
    cloudDomeCoordinate([-epsilon, 1, 0]),
    cloudDomeCoordinate([0, 1, epsilon]),
    cloudDomeCoordinate([0, 1, -epsilon]),
  ]
  for (const [u, v] of samples) assert.ok(Math.hypot(u, v) < 1e-4)
})

test('rc50 cloud dome is continuous across the old longitude seam', () => {
  const epsilon = 1e-6
  const left = cloudDomeCoordinate([-1, 0.5, epsilon])
  const right = cloudDomeCoordinate([-1, 0.5, -epsilon])
  assert.ok(Math.hypot(left[0] - right[0], left[1] - right[1]) < 1e-5)
})
