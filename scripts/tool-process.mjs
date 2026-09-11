import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function resolveNpmInvocation({
  platform = process.platform,
  env = process.env,
  nodeExecutable = process.execPath,
} = {}) {
  const npmExecPath = String(env.npm_execpath ?? '').trim()
  if (npmExecPath) {
    return {
      command: nodeExecutable,
      prefixArgs: [npmExecPath],
    }
  }

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    prefixArgs: [],
  }
}

export async function runNpm(args, options = {}) {
  const invocation = resolveNpmInvocation()
  return execFileAsync(invocation.command, [...invocation.prefixArgs, ...args], options)
}

export async function runNode(args, options = {}) {
  return execFileAsync(process.execPath, args, options)
}

export async function runTypeScript(root, args, options = {}) {
  const local = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  if (existsSync(local)) return runNode([local, ...args], options)
  return execFileAsync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', args, options)
}
