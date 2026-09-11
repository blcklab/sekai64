import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from '@sekai64-internal/math'
import {
  CHARACTER_VISUAL_PRESET,
  createDirectionalShadowFrame,
  linearToSrgb,
  resolveAtmosphere,
  resolveColorGrading,
  resolveColorManagement,
  resolveShadowOptions,
  srgbToLinear,
  transformOutputColor,
} from './index.js'

describe('visual output pipeline', () => {
  it('uses ACES and sRGB output by default without clipping HDR input to white', () => {
    const resolved = resolveColorManagement()
    expect(resolved).toEqual({ toneMapping: 'aces', exposure: 1, outputColorSpace: 'srgb' })
    const result = transformOutputColor([4, 1, 0.25])
    expect(result[0]).toBeGreaterThan(result[1])
    expect(result[1]).toBeGreaterThan(result[2])
    expect(result.every(value => value >= 0 && value <= 1)).toBe(true)
  })

  it('round-trips sRGB and linear channels closely', () => {
    for (const value of [0, 0.02, 0.18, 0.5, 1]) expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 6)
  })

  it('normalizes shadow configuration to practical GPU values', () => {
    expect(resolveShadowOptions({ mapSize: 1500 }).mapSize).toBe(2048)
    expect(resolveShadowOptions({ mapSize: 99999 }).mapSize).toBe(4096)
    expect(resolveShadowOptions({ softness: 99 }).softness).toBe(2)
  })


  it('normalizes atmospheric depth and display grading safely', () => {
    expect(resolveAtmosphere({ enabled: true, mode: 'linear', near: 30, far: 10, maxOpacity: 3 })).toMatchObject({
      enabled: true,
      mode: 'linear',
      near: 30,
      far: 30.001,
      maxOpacity: 1,
    })
    expect(resolveColorGrading({ saturation: 5, contrast: -1, temperature: 2, vignetteSoftness: 0 })).toMatchObject({
      saturation: 2,
      contrast: 0,
      temperature: 1,
      vignetteSoftness: 0.05,
    })
  })

  it('provides a character preset with high-quality edge antialiasing', () => {
    expect(CHARACTER_VISUAL_PRESET.imageQuality.antialiasing).toBe('fxaa-high')
    expect(CHARACTER_VISUAL_PRESET.imageQuality.msaaSamples).toBe(4)
    expect(CHARACTER_VISUAL_PRESET.imageQuality.renderScale).toBeGreaterThan(1)
    expect(CHARACTER_VISUAL_PRESET.environmentLighting.specularIntensity).toBeLessThanOrEqual(1)
    expect(CHARACTER_VISUAL_PRESET.postProcessing?.outlines).toMatchObject({ enabled: true, mode: 'inverted-hull', charactersOnly: true })
  })

  it('creates a finite directional shadow frame for visible bounds', () => {
    const frame = createDirectionalShadowFrame(new Box3(new Vector3(-5, 0, -5), new Vector3(5, 4, 5)), [0.4, -1, 0.2])
    expect(frame).toBeDefined()
    expect(frame?.matrix.elements.every(Number.isFinite)).toBe(true)
    expect(frame?.radius).toBeGreaterThan(5)
  })
})
