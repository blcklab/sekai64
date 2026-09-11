import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDirectory = join(root, 'packages', 'sekai64')
const publicPackagePath = join(publicDirectory, 'package.json')
const publicPackage = JSON.parse(await readFile(publicPackagePath, 'utf8'))
const errors = []
const rootPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const graph = new Map()

if (publicPackage.name !== '@blcklab/sekai64') errors.push('The public workspace must be named @blcklab/sekai64.')
if (publicPackage.version !== rootPackage.version) errors.push('The public package version must match the workspace version.')
if (publicPackage.private === true) errors.push('The public workspace cannot be private.')
if (Object.keys(publicPackage.dependencies ?? {}).length > 0) errors.push('The public package must have zero runtime dependencies.')

const packageEntries = await readdir(join(root, 'packages'), { withFileTypes: true })
for (const entry of packageEntries) {
  if (!entry.isDirectory() || entry.name === 'sekai64') continue
  const packagePath = join(root, 'packages', entry.name, 'package.json')
  const value = JSON.parse(await readFile(packagePath, 'utf8'))
  if (value.private !== true) errors.push(`packages/${entry.name} must be private.`)
  if (value.name !== `@sekai64-internal/${entry.name}`) errors.push(`packages/${entry.name} has an invalid private package name.`)
  if (value.version !== rootPackage.version) errors.push(`packages/${entry.name} version must match ${rootPackage.version}.`)
  const internalDependencies = Object.entries(value.dependencies ?? {}).filter(([name]) => name.startsWith('@sekai64-internal/'))
  graph.set(value.name, internalDependencies.map(([name]) => name))
  for (const [name, version] of internalDependencies) if (version !== rootPackage.version) errors.push(`${value.name} pins ${name} to ${version}; expected ${rootPackage.version}.`)
}


const visiting = new Set()
const visited = new Set()
function visit(name, path = []) {
  if (visiting.has(name)) { errors.push(`Private workspace dependency cycle: ${[...path, name].join(' -> ')}`); return }
  if (visited.has(name)) return
  visiting.add(name)
  for (const dependency of graph.get(name) ?? []) visit(dependency, [...path, name])
  visiting.delete(name)
  visited.add(name)
}
for (const name of graph.keys()) visit(name)

const examplesDirectory = join(root, 'examples')
for (const entry of await readdir(examplesDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const value = JSON.parse(await readFile(join(examplesDirectory, entry.name, 'package.json'), 'utf8'))
  if (value.version !== rootPackage.version) errors.push(`examples/${entry.name} version must match ${rootPackage.version}.`)
  const engineVersion = value.dependencies?.['@blcklab/sekai64']
  if (engineVersion !== rootPackage.version) errors.push(`examples/${entry.name} must depend on @blcklab/sekai64 ${rootPackage.version}.`)
}

for (const [subpath, target] of Object.entries(publicPackage.exports ?? {})) {
  if (subpath === './package.json') continue
  const values = typeof target === 'string' ? [target] : Object.values(target)
  for (const value of values) {
    if (typeof value !== 'string') continue
    try { await access(join(publicDirectory, value)) }
    catch { errors.push(`Missing export target for ${subpath}: ${value}`) }
  }
}

const distDirectory = join(publicDirectory, 'dist')
const textFiles = await collectTextFiles(distDirectory)
const forbidden = ['@sekai64-internal/', '@blcklab/sekai64-core', '@blcklab/sekai64-math', '@blcklab/sekai64-scene', '@blcklab/sekai64-renderer-']
for (const file of textFiles) {
  const source = await readFile(file, 'utf8')
  for (const value of forbidden) {
    if (source.includes(value)) errors.push(`${file.replace(root + '/', '')} contains forbidden specifier ${value}`)
  }
  const bareImports = [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^.'"][^'"]*)\1/g)].map(match => match[2])
  for (const specifier of bareImports) errors.push(`${file.replace(root + '/', '')} contains external runtime import ${specifier}`)
}

if (errors.length > 0) {
  console.error('Public package verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Verified @blcklab/sekai64: one public package, ${Object.keys(publicPackage.exports).length} exports, zero runtime dependencies.`)
}

async function collectTextFiles(directory) {
  const files = []
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectTextFiles(path))
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}
