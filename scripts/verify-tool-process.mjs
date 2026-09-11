import assert from 'node:assert/strict'
import { resolveNpmInvocation } from './tool-process.mjs'

assert.deepEqual(
  resolveNpmInvocation({
    platform: 'win32',
    env: {},
    nodeExecutable: 'node.exe',
  }),
  {
    command: 'npm.cmd',
    prefixArgs: [],
  },
)

assert.deepEqual(
  resolveNpmInvocation({
    platform: 'win32',
    env: {
      npm_execpath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    },
    nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe',
  }),
  {
    command: 'C:\\Program Files\\nodejs\\node.exe',
    prefixArgs: ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'],
  },
)

assert.deepEqual(
  resolveNpmInvocation({
    platform: 'linux',
    env: {},
    nodeExecutable: '/usr/bin/node',
  }),
  {
    command: 'npm',
    prefixArgs: [],
  },
)

console.log('Cross-platform npm process invocation verification passed.')
