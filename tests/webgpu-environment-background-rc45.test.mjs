import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('rc45 WebGPU environment background pipeline matches the main pass depth/MSAA attachment contract', async () => {
  const source = await readFile(new URL('../packages/renderer-webgpu/src/WebGPURenderer.ts', import.meta.url), 'utf8')

  assert.match(source, /Sekai64 depth texture[\s\S]*sampleCount:\s*this\.sampleCount[\s\S]*format:\s*'depth24plus'/)
  assert.match(source, /Sekai64 main pass[\s\S]*depthStencilAttachment:\s*\{[\s\S]*depthClearValue:\s*1/)
  assert.match(
    source,
    /Sekai64 environment background pipeline[\s\S]*depthStencil:\s*\{\s*format:\s*'depth24plus',\s*depthWriteEnabled:\s*false,\s*depthCompare:\s*'less-equal'\s*\}[\s\S]*multisample:\s*\{\s*count:\s*this\.sampleCount\s*\}/,
  )
  assert.match(source, /output\.position=vec4<f32>\(p,0\.999999,1\.0\)/)
})
