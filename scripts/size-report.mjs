import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'packages', 'sekai64', 'dist')
const entries = [
  { name: 'root', file: 'index.js', budget: 64 * 1024 },
  { name: 'materials', file: 'materials/index.js', budget: 24 * 1024 },
  { name: 'dynamic texture', file: 'dynamic-texture/index.js', budget: 16 * 1024 },
  { name: 'scene', file: 'scene/index.js', budget: 36 * 1024 },
  { name: 'WebGL2 renderer', file: 'renderer-webgl2/index.js', budget: 68 * 1024 },
  { name: 'WebGPU renderer', file: 'renderer-webgpu/index.js', budget: 68 * 1024 },
  { name: 'module contracts', file: 'modules/index.js', budget: 8 * 1024 },
  { name: 'animation', file: 'animation/index.js', budget: 36 * 1024 },
  { name: 'decoder registry', file: 'decoders/index.js', budget: 8 * 1024 },
  { name: 'streaming', file: 'streaming/index.js', budget: 16 * 1024 },
  { name: 'environment', file: 'environment/index.js', budget: 27 * 1024 },
  { name: 'environment tools', file: 'environment-authoring/index.js', budget: 32 * 1024 },
  { name: 'texture tools', file: 'texture-tools/index.js', budget: 12 * 1024 },
  { name: 'large scene', file: 'large-scene/index.js', budget: 28 * 1024 },
  { name: 'recovery', file: 'recovery/index.js', budget: 12 * 1024 }
]

let failed = false
for (const entry of entries) {
  const files = await collectStaticGraph(join(dist, entry.file))
  const sources = await Promise.all([...files].sort().map(path => readFile(path)))
  const raw = sources.reduce((sum, source) => sum + source.byteLength, 0)
  const gzip = gzipSync(Buffer.concat(sources)).byteLength
  const status = gzip <= entry.budget ? 'PASS' : 'FAIL'
  console.log(`${status} ${entry.name.padEnd(18)} ${format(gzip)} gzip · ${format(raw)} raw · ${files.size} modules · budget ${format(entry.budget)}`)
  if (gzip > entry.budget) failed = true
}

if (failed) {
  console.error('One or more Sekai64 static-entry size budgets were exceeded.')
  process.exitCode = 1
}

async function collectStaticGraph(entry) {
  const visited = new Set()
  async function visit(path) {
    path = normalize(path)
    if (visited.has(path)) return
    visited.add(path)
    const source = await readFile(path, 'utf8')
    const pattern = /(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"()]*?\s+from\s+)['"]([^'"]+)['"]/g
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (!specifier?.startsWith('.')) continue
      let target = resolve(dirname(path), specifier)
      if (!extname(target)) target += '.js'
      await visit(target)
    }
  }
  await visit(entry)
  return visited
}

function format(bytes) { return `${(bytes / 1024).toFixed(1)} kB` }
