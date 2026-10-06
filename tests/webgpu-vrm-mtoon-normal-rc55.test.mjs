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

test('rc55 keeps missing-tangent normal-map reconstruction finite in WebGPU and WebGL2', async () => {
  const [wgslHost, glslHost] = await Promise.all([
    readFile(new URL('packages/renderer-webgpu/src/WebGPURenderer.ts', root), 'utf8'),
    readFile(new URL('packages/renderer-webgl2/src/WebGL2Renderer.ts', root), 'utf8'),
  ])

  const wgsl = between(wgslHost, 'fn fallbackSurfaceBasis', 'fn distributionGGX')
  const glsl = between(glslHost, 'mat3 fallbackSurfaceBasis', 'float distributionGGX')

  assert.match(wgsl, /abs\(n\.y\)>0\.999/)
  assert.match(wgsl, /cross\(referenceAxis,n\)/)
  assert.match(wgsl, /return fallbackSurfaceBasis\(n\)/)
  assert.match(wgsl, /mappedLengthSquared=dot\(mappedNormal,mappedNormal\)/)
  assert.match(wgsl, /if\(!\(mappedLengthSquared>0\.0000001\)\)\{return waterMacroNormal\(input,n\);\}/)
  assert.doesNotMatch(wgsl, /normalize\(vec3<f32>\(n\.z,0\.0,-n\.x\)\)/)

  assert.match(glsl, /abs\(n\.y\)>0\.999/)
  assert.match(glsl, /cross\(referenceAxis,n\)/)
  assert.match(glsl, /return fallbackSurfaceBasis\(n\)/)
  assert.match(glsl, /mappedLengthSquared=dot\(mappedNormal,mappedNormal\)/)
  assert.match(glsl, /if\(!\(mappedLengthSquared>0\.0000001\)\)return waterMacroNormal\(n\);/)
  assert.doesNotMatch(glsl, /normalize\(vec3\(n\.z,0\.0,-n\.x\)\)/)
})

test('rc55 preserves the derivative tangent path and authored tangent path', async () => {
  const [wgslHost, glslHost] = await Promise.all([
    readFile(new URL('packages/renderer-webgpu/src/WebGPURenderer.ts', root), 'utf8'),
    readFile(new URL('packages/renderer-webgl2/src/WebGL2Renderer.ts', root), 'utf8'),
  ])
  const wgsl = between(wgslHost, 'fn surfaceBasis', 'fn surfaceUv')
  const glsl = between(glslHost, 'mat3 surfaceBasis', 'vec2 surfaceUv')

  assert.match(wgsl, /dp1=dpdx\(input\.worldPosition\)/)
  assert.match(wgsl, /duv1=dpdx\(basisUv\)/)
  assert.match(glsl, /dp1=dFdx\(v_worldPosition\)/)
  assert.match(glsl, /duv1=dFdx\(basisUv\)/)
  for (const source of [wgsl, glsl]) {
    assert.match(source, /tangent\.xyz|v_tangent\.xyz/)
    assert.match(source, /basisScale/)
  }
})

test('rc55 orthonormal fallback remains finite at vertical and near-vertical normals', () => {
  const normalize = value => {
    const length = Math.hypot(...value)
    assert.ok(Number.isFinite(length) && length > 1e-12)
    return value.map(component => component / length)
  }
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0)
  const basis = input => {
    const n = normalize(input)
    const referenceAxis = Math.abs(n[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0]
    const tangent = normalize(cross(referenceAxis, n))
    const bitangent = normalize(cross(n, tangent))
    return { n, tangent, bitangent }
  }

  for (const normal of [[0, 1, 0], [0, -1, 0], [1e-7, 1, -2e-7], [0.3, 0.94, -0.16]]) {
    const { n, tangent, bitangent } = basis(normal)
    for (const component of [...n, ...tangent, ...bitangent]) assert.ok(Number.isFinite(component))
    assert.ok(Math.abs(dot(n, tangent)) < 1e-6)
    assert.ok(Math.abs(dot(n, bitangent)) < 1e-6)
    assert.ok(Math.abs(dot(tangent, bitangent)) < 1e-6)
  }
})
