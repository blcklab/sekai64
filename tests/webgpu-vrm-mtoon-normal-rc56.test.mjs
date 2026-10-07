import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

function between(source, start, end) {
  const a = source.indexOf(start)
  assert.ok(a >= 0, `missing ${start}`)
  const b = source.indexOf(end, a + start.length)
  assert.ok(b > a, `missing ${end}`)
  return source.slice(a, b)
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function scale(a, s) { return a.map(value => value * s) }
function add(a, b) { return a.map((value, index) => value + b[index]) }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0) }
function approxVector(actual, expected, epsilon = 1e-12) {
  assert.equal(actual.length, expected.length)
  for (let index = 0; index < actual.length; index += 1) assert.ok(Math.abs(actual[index] - expected[index]) <= epsilon)
}

function normalize(a) {
  const length = Math.hypot(...a)
  assert.ok(length > 1e-12)
  return scale(a, 1 / length)
}

function derivativeBasis({ dpdx, dpdy, duvdx, duvdy, normal }) {
  const dp2perp = cross(dpdy, normal)
  const dp1perp = cross(normal, dpdx)
  return {
    tangent: add(scale(dp2perp, duvdx[0]), scale(dp1perp, duvdy[0])),
    bitangent: add(scale(dp2perp, duvdx[1]), scale(dp1perp, duvdy[1])),
  }
}

test('rc56 compensates only WebGPU derivative-reconstructed tangent axes', async () => {
  const [wgslHost, glslHost] = await Promise.all([
    readFile(new URL('packages/renderer-webgpu/src/WebGPURenderer.ts', root), 'utf8'),
    readFile(new URL('packages/renderer-webgl2/src/WebGL2Renderer.ts', root), 'utf8'),
  ])

  const wgsl = between(wgslHost, 'fn surfaceBasis', 'fn surfaceUv')
  const glsl = between(glslHost, 'mat3 surfaceBasis', 'vec2 surfaceUv')

  assert.match(wgsl, /if\(length\(input\.tangent\.xyz\)>0\.0001\)\{t=normalize\(input\.tangent\.xyz-n\*dot\(n,input\.tangent\.xyz\)\);b=normalize\(cross\(n,t\)\)\*input\.tangent\.w;\}/)
  assert.match(wgsl, /t=-t;b=-b;/)
  assert.equal((wgsl.match(/t=-t;b=-b;/g) ?? []).length, 1)
  assert.doesNotMatch(glsl, /t=-t;b=-b;/)

  const authoredBranchEnd = wgsl.indexOf('input.tangent.w;}')
  const compensation = wgsl.indexOf('t=-t;b=-b;')
  assert.ok(authoredBranchEnd >= 0 && compensation > authoredBranchEnd, 'authored glTF tangent path must remain untouched')
})

test('rc56 derivative compensation restores WebGL/glTF tangent-frame parity', () => {
  const normal = [0, 0, 1]
  const webgl = derivativeBasis({
    dpdx: [1, 0, 0],
    dpdy: [0, 1, 0],
    duvdx: [1, 0],
    duvdy: [0, 1],
    normal,
  })

  // WGSL fragment coordinates grow in the opposite framebuffer Y direction,
  // so the same surface presents negated Y derivatives to the cotangent frame.
  const rawWebGpu = derivativeBasis({
    dpdx: [1, 0, 0],
    dpdy: [0, -1, 0],
    duvdx: [1, 0],
    duvdy: [0, -1],
    normal,
  })
  const correctedWebGpu = {
    tangent: scale(rawWebGpu.tangent, -1),
    bitangent: scale(rawWebGpu.bitangent, -1),
  }

  approxVector(rawWebGpu.tangent, scale(webgl.tangent, -1))
  approxVector(rawWebGpu.bitangent, scale(webgl.bitangent, -1))
  approxVector(correctedWebGpu.tangent, webgl.tangent)
  approxVector(correctedWebGpu.bitangent, webgl.bitangent)

  // A non-flat tangent-space normal demonstrates why the sign matters for light response.
  const tangentNormal = normalize([0.65, 0.35, 0.67])
  const mapToWorld = (basis) => normalize(add(add(scale(basis.tangent, tangentNormal[0]), scale(basis.bitangent, tangentNormal[1])), scale(normal, tangentNormal[2])))
  const accepted = mapToWorld(webgl)
  const broken = mapToWorld(rawWebGpu)
  const corrected = mapToWorld(correctedWebGpu)
  const light = normalize([0.65, 0.35, 0.67])

  assert.ok(dot(accepted, light) > 0.99)
  assert.ok(dot(broken, light) < dot(accepted, light) - 0.5, 'uncompensated WebGPU basis can strongly darken a normal-mapped surface')
  assert.ok(Math.abs(dot(corrected, light) - dot(accepted, light)) < 1e-12)
})
