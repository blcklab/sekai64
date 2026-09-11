import assert from 'node:assert/strict'
import { DecoderRegistry } from '@blcklab/sekai64/decoders'
import { createDracoAdapter } from '@blcklab/sekai64-draco'
import { createMeshoptAdapter } from '@blcklab/sekai64-meshopt'
import { createKtx2Adapter } from '@blcklab/sekai64-ktx2'

const registry = new DecoderRegistry()
let disposed = 0
registry.register(createDracoAdapter({ async decode(data, _options, context) { context.report(0.5, 'decode'); return data.byteLength }, dispose() { disposed += 1 } }))
registry.register(createMeshoptAdapter({ async decode(data) { return data.byteLength + 1 }, dispose() { disposed += 1 } }))
registry.register(createKtx2Adapter({ async transcode(data) { return { bytes: data.byteLength } }, dispose() { disposed += 1 } }))
assert.equal((await registry.decode({ format: 'draco', data: new ArrayBuffer(3) })).value, 3)
assert.equal((await registry.decode({ format: 'EXT_meshopt_compression', data: new ArrayBuffer(3) })).value, 4)
assert.deepEqual((await registry.decode({ format: 'KHR_texture_basisu', data: new ArrayBuffer(5) })).value, { bytes: 5 })
assert.equal(registry.supports('basis'), true)
await registry.disposeAsync()
assert.equal(disposed, 3)
console.log('Sekai64 optional decoder adapter assertions passed.')
