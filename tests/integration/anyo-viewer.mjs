import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adapterPath = process.argv[2]
if (!adapterPath) {
  throw new Error('Usage: node tests/integration/anyo-viewer.mjs /path/to/Anyo/src/renderer-sekai64/Sekai64Renderer.ts')
}

const anyoAdapter = readFileSync(adapterPath, 'utf8')
assert.match(anyoAdapter, /prefilterEnvironment\(sky/)
assert.match(anyoAdapter, /format:\s*'rgba16f-linear'/)
assert.doesNotMatch(anyoAdapter, /sky\.toLdr\(\)/)
console.log('Anyo viewer HDR adapter source checks passed.')
