import { describe, expect, it } from 'vitest'
import { AmbientLight } from '@sekai64-internal/lighting'
import { ShadowBudgetManager } from './index.js'
describe('shadow budgets', () => { it('honors light and pixel limits', () => { const a = new AmbientLight({ id: 'a' }) as AmbientLight & { castShadow: boolean }; a.castShadow = true; const b = new AmbientLight({ id: 'b' }) as AmbientLight & { castShadow: boolean }; b.castShadow = true; const manager = new ShadowBudgetManager({ maxLights: 1, maxPixels: 1024 * 1024 }); expect(manager.allocate([{ light: a, priority: 1 }, { light: b }])).toHaveLength(1) }) })
