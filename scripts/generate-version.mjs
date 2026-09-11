import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = resolve(root, 'packages/sekai64/package.json')
const publicTargetPath = resolve(root, 'packages/sekai64/src/version.ts')
const moduleTargetPath = resolve(root, 'packages/modules/src/version.ts')
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const version = String(packageJson.version ?? '').trim()
if (!version) throw new Error('packages/sekai64/package.json must contain a version.')

const generatedHeader = '/** Generated from packages/sekai64/package.json. Do not edit manually. */\n'
await Promise.all([
  writeFile(publicTargetPath, `${generatedHeader}export const SEKAI64_VERSION = ${JSON.stringify(version)} as const\n`),
  writeFile(moduleTargetPath, `${generatedHeader}export const SEKAI64_MODULE_VERSION = ${JSON.stringify(version)} as const\n`),
])

console.log(`Generated Sekai64 public and module versions ${version}.`)
