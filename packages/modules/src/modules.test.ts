import { describe, expect, it } from 'vitest'
import { RendererModuleHost, type RendererModule } from './index.js'

const renderer = { backend: 'webgl2' } as never

describe('RendererModuleHost', () => {
  it('orders dependencies and disposes in reverse', async () => {
    const order: string[] = []
    const module = (id: string, requires: readonly string[] = []): RendererModule => ({
      id,
      requires,
      setup: () => { order.push(`setup:${id}`); return { dispose: () => { order.push(`dispose:${id}`) } } },
    })
    const host = new RendererModuleHost(renderer)
    await host.installAll([module('b', ['a']), module('a')])
    expect(order).toEqual(['setup:a', 'setup:b'])
    await host.disposeAsync()
    expect(order).toEqual(['setup:a', 'setup:b', 'dispose:b', 'dispose:a'])
  })

  it('rejects cycles', async () => {
    const host = new RendererModuleHost(renderer)
    await expect(host.installAll([
      { id: 'a', requires: ['b'], setup: () => undefined },
      { id: 'b', requires: ['a'], setup: () => undefined },
    ])).rejects.toThrow('dependency cycle')
  })
})
