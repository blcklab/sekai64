import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import config from './project.config.mjs'

const nextBase = process.argv[2]
const nextScope = process.argv[3] ?? config.packageScope
const nextProductName = process.argv[4] ?? toProductName(nextBase ?? '')

if (!nextBase || !/^[a-z][a-z0-9-]*$/.test(nextBase)) {
  console.error('Usage: npm run rename -- <package-name> [@scope] [Product Name]')
  process.exit(1)
}
if (!/^@[a-z0-9][a-z0-9-]*$/.test(nextScope)) {
  console.error('The npm scope must look like @scope.')
  process.exit(1)
}

const oldPublicName = `${config.packageScope}/${config.packageBase}`
const nextPublicName = `${nextScope}/${nextBase}`
const allowedExtensions = new Set(['.json', '.ts', '.tsx', '.js', '.mjs', '.md', '.yml', '.yaml', '.html'])
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage'])

for (const file of await collectTextFiles('.')) {
  let text = await readFile(file, 'utf8')
  text = text.replaceAll(oldPublicName, nextPublicName)
  text = text.replaceAll(`${config.packageBase}-workspace`, `${nextBase}-workspace`)
  text = text.replaceAll(config.productName, nextProductName)
  await writeFile(file, text)
}

await writeFile('scripts/project.config.mjs', `export default ${JSON.stringify({
  productName: nextProductName,
  packageScope: nextScope,
  packageBase: nextBase,
  repository: `https://github.com/${nextScope.slice(1)}/${nextBase}`
}, null, 2)}\n`)

console.log(`Renamed public package references from ${oldPublicName} to ${nextPublicName}.`)

async function collectTextFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectTextFiles(path))
    else if (allowedExtensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

function toProductName(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
