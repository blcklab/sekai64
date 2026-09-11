import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tests = (await readdir(join(root, 'tests'), { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.mjs'))
  .map(entry => `tests/${entry.name}`)
  .sort()

if (tests.length === 0) throw new Error('No test files found in tests/.')

// Explicit discovery works on Windows too, without relying on shell glob expansion.
// Each file runs in its own process so browser/GPU mocks cannot leak between tests.
const result = spawnSync(process.execPath, [
  '--import', new URL('./register-workspace-loader.mjs', import.meta.url).href,
  '--test',
  '--test-reporter=spec',
  '--test-timeout=60000',
  ...tests
], { cwd: root, stdio: 'inherit', windowsHide: true })

if (result.error) throw result.error
process.exitCode = result.status ?? 1
