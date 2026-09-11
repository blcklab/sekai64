import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const config = JSON.parse(await readFile(new URL('tsconfig.base.json', root), 'utf8'))
const options = config.compilerOptions ?? {}

assert.equal('baseUrl' in options, false, 'tsconfig.base.json must not use deprecated baseUrl.')
for (const [alias, targets] of Object.entries(options.paths ?? {})) {
  assert.ok(Array.isArray(targets) && targets.length > 0, `${alias} must declare at least one path target.`)
  for (const target of targets) {
    assert.match(target, /^\.\.?\//, `${alias} target ${target} must be explicitly relative.`)
  }
}

const examplesConfig = JSON.parse(await readFile(new URL('examples/tsconfig.json', root), 'utf8'))
const exampleIncludes = examplesConfig.include ?? []
assert.ok(exampleIncludes.includes('env.d.ts'), 'examples/tsconfig.json must include the shared asset declarations.')
const exampleEnvironment = await readFile(new URL('examples/env.d.ts', root), 'utf8')
assert.match(exampleEnvironment, /declare module ['"]\*\.css['"]/, 'examples/env.d.ts must declare CSS side-effect imports.')

console.log('TypeScript 6/7 path mapping and browser-asset declarations verification passed.')
