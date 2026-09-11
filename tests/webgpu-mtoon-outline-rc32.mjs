import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

assert.doesNotMatch(source, /clip\.xy\s*=/, 'WGSL must not assign to a multi-component vector swizzle')
assert.match(
  source,
  /clip=vec4<f32>\(clip\.xy\+direction\*outlineWidth\*2\.0\*clip\.w,clip\.z,clip\.w\)/,
  'screen-coordinate MToon outlines must rebuild the clip-space vec4 after XY extrusion',
)
assert.match(
  source,
  /clip=vec4<f32>\(clip\.xy,\(clip\.z\+clip\.w\)\*0\.5,clip\.w\)/,
  'WebGPU depth remapping must preserve XY/W while rebuilding clip-space safely',
)

console.log('Sekai64 RC.32 WebGPU MToon outline WGSL regression passed.')
