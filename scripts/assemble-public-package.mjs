import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagesDirectory = join(root, 'packages')
const publicDirectory = join(packagesDirectory, 'sekai64')
const publicDist = join(publicDirectory, 'dist')

const entries = await readdir(packagesDirectory, { withFileTypes: true })
const modules = entries
  .filter(entry => entry.isDirectory() && entry.name !== 'sekai64')
  .map(entry => entry.name)
  .sort()

await mkdir(publicDist, { recursive: true })

for (const moduleName of modules) {
  const source = join(packagesDirectory, moduleName, 'dist')
  const destination = join(publicDist, moduleName)
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, { recursive: true })
}

const textFiles = await collectTextFiles(publicDist)
const specifiers = modules
  .map(moduleName => ({ moduleName, specifier: `@sekai64-internal/${moduleName}` }))
  .sort((a, b) => b.specifier.length - a.specifier.length)

for (const file of textFiles) {
  let source = await readFile(file, 'utf8')
  for (const { moduleName, specifier } of specifiers) {
    const target = join(publicDist, moduleName, 'index.js')
    let replacement = relative(dirname(file), target).split(sep).join('/')
    if (!replacement.startsWith('.')) replacement = `./${replacement}`
    source = source.replace(new RegExp(`${escapeRegExp(specifier)}(?=['"])`, 'g'), replacement)
  }
  source = source.replace(/\n?\/\/#[#@]? sourceMappingURL=.*$/gm, '')
  await writeFile(file, source)
}

for (const file of await collectSourceMaps(publicDist)) await rm(file, { force: true })

const beveledAliasDirectory = join(publicDist, 'geometry', 'beveled-box')
await mkdir(beveledAliasDirectory, { recursive: true })
await writeFile(join(beveledAliasDirectory, 'index.js'), "export { BeveledBoxGeometry } from '../BeveledBoxGeometry.js'\n")
await writeFile(join(beveledAliasDirectory, 'index.d.ts'), "export { BeveledBoxGeometry, type BeveledBoxGeometryOptions } from '../BeveledBoxGeometry.js'\n")

console.log(`Assembled @blcklab/sekai64 from ${modules.length} private workspaces.`)

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function collectSourceMaps(directory) {
  const files = []
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectSourceMaps(path))
    else if (entry.name.endsWith('.map')) files.push(path)
  }
  return files
}
