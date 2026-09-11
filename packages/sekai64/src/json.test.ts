import { describe, expect, it } from 'vitest'
import { BasicMaterial, Mesh } from './index.js'
import { loadSceneDefinition } from './json.js'

describe('JSON scenes', () => {
  it('loads and patches a box by stable ID', async () => {
    const loaded = await loadSceneDefinition({
      version: 1,
      scene: { objects: [{ id: 'product', type: 'box', position: [1, 2, 3], material: { baseColor: '#ff0000' } }] }
    })
    const product = loaded.get('product')
    expect(product).toBeInstanceOf(Mesh)
    loaded.patch([{ op: 'replace', path: '/objects/product/position', value: [4, 5, 6] }])
    expect(product?.position.x).toBe(4)
    loaded.patch([{ op: 'replace', path: '/objects/product/material/baseColor', value: '#00ff00' }])
    expect((product as Mesh).material).toBeInstanceOf(BasicMaterial)
    expect(((product as Mesh).material as BasicMaterial).baseColor.g).toBe(1)
  })

  it('reports exact validation paths', async () => {
    await expect(loadSceneDefinition({ version: 1, scene: { objects: [{ type: 'box', position: [1, 2] }] } } as never)).rejects.toThrow('scene.objects[0].position')
  })
})
