import { describe, expect, it } from 'vitest'
import { EnvironmentResource, toneMap } from './index.js'
describe('environment resources', () => { it('tone maps HDR values', () => { expect(toneMap(10, 'aces')).toBeGreaterThan(0.9) }); it('computes an average', () => { const value = new EnvironmentResource({ id: 'e', width: 1, height: 1, pixels: new Float32Array([2, 1, 0]) }); expect(value.average.r).toBe(2) }) })
