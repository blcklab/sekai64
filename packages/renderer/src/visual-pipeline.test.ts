import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { Box3, Vector3 } from '@sekai64-internal/math'
import {
  CHARACTER_VISUAL_PRESET,
  createDirectionalShadowCascades,
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


  it('stabilizes directional cascades in the light projection plane', () => {
    const camera = new PerspectiveCamera({ fieldOfView: 60, aspect: 16 / 9, near: 0.1, far: 500 })
    camera.position.set(2.345, 3, 8.765)
    camera.lookAt([2.345, 2.7, 0])
    camera.updateMatrices()
    const options = { cascades: 1, maxDistance: 80, splitLambda: 0.65, cameraPadding: 2, stabilize: true, mapSize: 2048 }
    const first = createDirectionalShadowCascades(camera, [0.45, -1, 0.3], options)[0]
    expect(first).toBeDefined()
    if (!first) return

    // Move less than one shadow texel in world space. A stabilized cascade may
    // change in light-space depth, but its projected X/Y translation should
    // remain locked to the same texel grid rather than sliding continuously.
    camera.position.x += 0.001
    camera.position.z += 0.001
    camera.lookAt([2.346, 2.7, 0.001])
    camera.updateMatrices()
    const second = createDirectionalShadowCascades(camera, [0.45, -1, 0.3], options)[0]
    expect(second).toBeDefined()
    if (!second) return

    const texel = (first.radius * 2) / options.mapSize
    const firstElements = first.matrix.elements
    const secondElements = second.matrix.elements
    expect(Math.abs((firstElements[12] ?? 0) - (secondElements[12] ?? 0))).toBeLessThanOrEqual(texel * 0.02)
    expect(Math.abs((firstElements[13] ?? 0) - (secondElements[13] ?? 0))).toBeLessThanOrEqual(texel * 0.02)
  })
})
