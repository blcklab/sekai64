import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
const root = resolve('.')
const expected = {
  draco: ['@blcklab/sekai64-draco', 'createDracoAdapter'],
  meshopt: ['@blcklab/sekai64-meshopt', 'createMeshoptAdapter'],
  ktx2: ['@blcklab/sekai64-ktx2', 'createKtx2Adapter'],
}
for (const [directory, [name, exportName]] of Object.entries(expected)) {
  const base = join(root, 'optional-adapters', directory)
  const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
  assert.equal(pkg.name, name)
  assert.equal(pkg.version, '0.1.0')
  assert.deepEqual(pkg.dependencies ?? {}, {})
  assert.equal(pkg.sideEffects, false)
  assert.equal(pkg.peerDependencies?.['@blcklab/sekai64'], '>=0.8.0-rc.10 <0.9.0')
  await access(join(base, 'dist', 'index.js'))
  await access(join(base, 'dist', 'index.d.ts'))
  const value = await import(new URL(`../optional-adapters/${directory}/dist/index.js`, import.meta.url))
  assert.equal(typeof value[exportName], 'function')
}
console.log('Verified optional Draco, Meshopt, and KTX2 adapter packages: explicit injection, zero bundled codecs.')
