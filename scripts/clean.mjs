import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

const packageDirectories = await readdir('packages', { withFileTypes: true })
for (const entry of packageDirectories) {
  if (!entry.isDirectory()) continue
  const directory = join('packages', entry.name)
  await rm(join(directory, 'dist'), { recursive: true, force: true })
  await rm(join(directory, '.tsbuildinfo'), { force: true })
}
await rm('coverage', { recursive: true, force: true })

const adapterDirectories = await readdir('optional-adapters', { withFileTypes: true })
for (const entry of adapterDirectories) {
  if (!entry.isDirectory()) continue
  const directory = join('optional-adapters', entry.name)
  await rm(join(directory, 'dist'), { recursive: true, force: true })
  await rm(join(directory, '.tsbuildinfo'), { force: true })
}
