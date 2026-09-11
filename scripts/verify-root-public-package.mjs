import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (subpath === './package.json') continue
  for (const value of typeof target === 'string' ? [target] : Object.values(target)) {
    if (typeof value === 'string') await access(resolve(root, value))
  }
}
console.log('Verified root @blcklab/sekai64 workspace export targets.')
