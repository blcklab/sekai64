import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const gpu = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

test('rc54 WebGPU procedural cloud WGSL avoids reserved macro identifier', () => {
  const start = gpu.indexOf('fn proceduralCloud')
  assert.ok(start >= 0, 'proceduralCloud WGSL function must exist')
  const end = gpu.indexOf('\n', start)
  const cloudShader = gpu.slice(start, end > start ? end : undefined)
  assert.doesNotMatch(cloudShader, /\blet\s+macro\s*=/)
  assert.match(cloudShader, /\blet\s+macroField\s*=cloudMacroField/)
  assert.match(cloudShader, /field=clamp\(macroField\*0\.88/)
})
