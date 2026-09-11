import { describe, expect, it } from 'vitest'
import { AssetTaskScheduler } from './index.js'

describe('AssetTaskScheduler', () => {
  it('deduplicates cached tasks', async () => {
    const scheduler = new AssetTaskScheduler(1)
    let runs = 0
    const task = async (): Promise<number> => { runs += 1; return 7 }
    const [a, b] = await Promise.all([scheduler.schedule('same', task), scheduler.schedule('same', task)])
    expect(a.value).toBe(7); expect(b.value).toBe(7); expect(runs).toBe(1)
    a.dispose(); b.dispose(); scheduler.dispose()
  })
})
