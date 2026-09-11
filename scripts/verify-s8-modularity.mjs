import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'packages', 'sekai64', 'dist')
const entries = {
  root: 'index.js',
  animation: 'animation/index.js',
  decoders: 'decoders/index.js',
  environment: 'environment/index.js',
  largeScene: 'large-scene/index.js',
  recovery: 'recovery/index.js',
  streaming: 'streaming/index.js',
}
const graphs = new Map()
for (const [name, file] of Object.entries(entries)) graphs.set(name, await collectStaticGraph(join(dist, file)))

const rootGraph = graphs.get('root')
const hasGraphPath = (graph, fragment) => [...graph].some(path => toPortablePath(path).includes(fragment))
for (const optional of ['animation', 'decoders', 'environment', 'large-scene', 'recovery', 'streaming']) {
  assert.equal(hasGraphPath(rootGraph, `/dist/${optional}/`), false, `Root entry must not import ./${optional}.`)
}
assert.ok(hasGraphPath(rootGraph, '/dist/modules/'), 'Root Engine should include only the tiny renderer-module host contract.')

const forbiddenCrossImports = {
  animation: ['environment', 'large-scene', 'recovery', 'streaming', 'decoders'],
  decoders: ['animation', 'environment', 'large-scene', 'recovery', 'streaming'],
  environment: ['animation', 'decoders', 'large-scene', 'recovery', 'streaming'],
  largeScene: ['animation', 'decoders', 'environment', 'recovery', 'streaming'],
  recovery: ['animation', 'decoders', 'environment', 'large-scene', 'streaming'],
  streaming: ['animation', 'decoders', 'environment', 'large-scene', 'recovery'],
}
for (const [entry, forbidden] of Object.entries(forbiddenCrossImports)) {
  const graph = graphs.get(entry)
  for (const subpath of forbidden) {
    assert.equal(hasGraphPath(graph, `/dist/${subpath}/`), false, `./${entry} must not import ./${subpath}.`)
  }
}

const publicPackage = JSON.parse(await readFile(join(root, 'packages', 'sekai64', 'package.json'), 'utf8'))
assert.deepEqual(publicPackage.dependencies ?? {}, {}, 'The public package must remain zero-dependency.')
assert.equal(publicPackage.sideEffects, false, 'The package must remain tree-shakable.')

const engineSource = await readFile(join(root, 'packages', 'sekai64', 'src', 'Engine.ts'), 'utf8')
for (const optional of ['animation', 'decoders', 'environment', 'large-scene', 'recovery', 'streaming']) {
  assert.equal(engineSource.includes(`@sekai64-internal/${optional}`), false, `Engine must not import ${optional}.`)
}

console.log('Sekai64 S8 modularity verification passed: optional graphs are isolated and the root remains zero-dependency.')

function toPortablePath(path) {
  return path.replaceAll('\\', '/')
}

assert.equal(
  toPortablePath('C:\\sekai64\\packages\\sekai64\\dist\\modules\\index.js').includes('/dist/modules/'),
  true,
  'Windows graph paths must normalize before modularity assertions.',
)

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
