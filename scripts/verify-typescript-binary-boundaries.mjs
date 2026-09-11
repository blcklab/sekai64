import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../packages/gltf/src/GltfLoader.ts', import.meta.url), 'utf8')

assert.match(source, /function toOwnedArrayBuffer\(bytes: Uint8Array\): ArrayBuffer/)
assert.match(source, /buffers\.push\(toOwnedArrayBuffer\(decodeDataUri\(definition\.uri\)\.bytes\)\)/)
assert.match(source, /new Blob\(\[toOwnedArrayBuffer\(bytes\)\]/)
assert.match(source, /new Blob\(\[toOwnedArrayBuffer\(decoded\.bytes\)\]/)
assert.doesNotMatch(source, /decodeDataUri\([^\n]+\)\.bytes\.buffer/)
assert.doesNotMatch(source, /new Blob\(\[(?:decoded\.)?bytes\]/)

console.log('TypeScript binary ownership verification passed.')
