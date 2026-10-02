import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PointField } from '@blcklab/sekai64/scene'
import { SEKAI64_VERSION } from '@blcklab/sekai64'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('rc46 PointField packs generic points and normalizes directional vectors', () => {
  const field = new PointField({
    id: 'stars',
    space: 'directional',
    defaultColor: [0.25, 0.5, 1, 0.8],
    defaultSize: 0.75,
    defaultIntensity: 0.6,
    points: [
      { position: [0, 3, 4] },
      { position: [2, 0, 0], color: [2, -1, 0.5], size: 1.5, intensity: 2 },
    ],
  })

  assert.equal(field.count, 2)
  assert.equal(field.space, 'directional')
  assert.deepEqual(Array.from(field.positions.slice(0, 3)), [0, 0.6000000238418579, 0.800000011920929])
  assert.deepEqual(Array.from(field.positions.slice(3, 6)), [1, 0, 0])
  assert.deepEqual(Array.from(field.colors.slice(0, 4)), [0.25, 0.5, 1, 0.800000011920929])
  assert.deepEqual(Array.from(field.colors.slice(4, 8)), [1, 0, 0.5, 1])
  assert.deepEqual(Array.from(field.sizes), [0.75, 1.5])
  assert.deepEqual(Array.from(field.intensities), [0.6000000238418579, 2])

  assert.throws(
    () => new PointField({ space: 'directional', points: [{ position: [0, 0, 0] }] }),
    /non-zero direction vectors/,
  )
})

test('rc46 point-field renderers use one instanced quad path with directional translation independence and matching depth/MSAA semantics', async () => {
  const [webgl, webgpu] = await Promise.all([
    readFile(new URL('../packages/renderer-webgl2/src/WebGL2Renderer.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8'),
  ])

  assert.match(webgl, /u_model\*vec4\(a_pointPosition,0\.0\)/, 'WebGL2 directional points must ignore node translation')
  assert.match(webgpu, /u\.model \* vec4<f32>\(input\.pointPosition, 0\.0\)/, 'WebGPU directional points must ignore node translation')
  assert.match(webgl, /drawArraysInstanced\(gl\.TRIANGLES, 0, 6, gpu\.count\)/, 'WebGL2 must draw the field in one instanced quad draw')
  assert.match(webgpu, /pass\.draw\(6, state\.count\)/, 'WebGPU must draw the field in one instanced quad draw')
  assert.match(webgpu, /depthWriteEnabled: false, depthCompare: 'less-equal'/, 'WebGPU point fields must preserve scene depth without writing it')
  assert.match(webgpu, /multisample: \{ count: this\.sampleCount \}/, 'WebGPU point fields must match the active main-pass MSAA sample count')
  assert.match(webgl, /gl\.depthMask\(false\)/, 'WebGL2 point fields must disable depth writes')
  assert.match(webgl, /clip\.z=clip\.w\*0\.999999/, 'WebGL2 directional points must sit at far depth')
  assert.match(webgpu, /clip\.z = clip\.w \* 0\.999999/, 'WebGPU directional points must sit at far depth')
})

test('public SEKAI64_VERSION exactly matches package.json', () => {
  assert.equal(SEKAI64_VERSION, packageJson.version)
})
