import { describe, expect, it } from 'vitest'
import { AssetManager } from './AssetManager.js'
import { AssetLoaderRegistry } from './AssetLoaderRegistry.js'

describe('AssetManager', () => {
  it('deduplicates cached requests and releases unused entries', async () => {
    const assets = new AssetManager()
    const first = await assets.loadText('data:text/plain,Sekai64')
    const second = await assets.loadText('data:text/plain,Sekai64')
    expect(first.value).toBe('Sekai64')
    expect(assets.stats).toMatchObject({ entries: 1, references: 2 })
    first.dispose(); second.dispose(); assets.clearUnused()
    expect(assets.stats.entries).toBe(0)
    assets.dispose()
  })
})

describe('AssetLoaderRegistry', () => {
  it('registers format-specific loaders without making formats core dependencies', async () => {
    const registry = new AssetLoaderRegistry()
    registry.register({
      type: 'model',
      formats: ['vrm'],
      async load(request) { return { src: request.src, format: request.format } },
    })
    expect(registry.supports('model', '.VRM')).toBe(true)
    await expect(registry.load({ type: 'model', format: 'vrm', src: '/avatar.vrm' }))
      .resolves.toEqual({ src: '/avatar.vrm', format: 'vrm' })
  })
})
