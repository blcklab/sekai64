import { describe, expect, it } from 'vitest'
import { DecoderRegistry } from './index.js'

describe('DecoderRegistry', () => {
  it('requires explicit adapters', async () => {
    const registry = new DecoderRegistry()
    await expect(registry.decode({ format: 'draco', data: new ArrayBuffer(0) })).rejects.toThrow('explicit optional adapter')
  })
  it('registers and disposes adapters', async () => {
    let disposed = false
    const registry = new DecoderRegistry()
    registry.register({ id: 'test', formats: ['foo'], decode: async request => ({ kind: 'test', value: request.data.byteLength }), dispose: () => { disposed = true } })
    expect((await registry.decode<number>({ format: '.FOO', data: new ArrayBuffer(4) })).value).toBe(4)
    await registry.disposeAsync()
    expect(disposed).toBe(true)
  })
})
