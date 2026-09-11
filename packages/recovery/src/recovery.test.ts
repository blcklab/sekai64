import { describe, expect, it } from 'vitest'
import { RendererRecoveryModule } from './index.js'
describe('recovery module', () => { it('rejects duplicate resources', () => { const module = new RendererRecoveryModule(); module.register({ id: 'a', restore: () => undefined }); expect(() => module.register({ id: 'a', restore: () => undefined })).toThrow('already registered') }) })
