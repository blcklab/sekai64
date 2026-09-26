import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { createProceduralSky } from '../dist/environment-authoring/index.js'

const cloudOptions = {
  width: 256,
  height: 128,
  cloudCoverage: 0.55,
  cloudDensity: 0.9,
  cloudScale: 3.3,
  cloudSeed: 919,
  sunDirection: [0.7, 0.65, -0.2],
  sunIntensity: 8,
  haze: 0.2,
}

test('Step 10 procedural cloud layer remains deterministic and seeded', () => {
  const first = createProceduralSky(cloudOptions)
  const second = createProceduralSky(cloudOptions)
  const changed = createProceduralSky({ ...cloudOptions, cloudSeed: 920 })
  assert.deepEqual(first.pixels, second.pixels)
  assert.notDeepEqual(first.pixels, changed.pixels)
  first.dispose(); second.dispose(); changed.dispose()
})

test('Step 10 distant clouds contain broad coverage, small-scale breakup, and stay above the horizon', () => {
  const cloudy = createProceduralSky(cloudOptions)
  const clear = createProceduralSky({ ...cloudOptions, cloudCoverage: 0 })
  let changedPixels = 0
  let lowerHemisphereChanges = 0
  let localEdges = 0
  for (let y = 0; y < cloudy.height; y += 1) {
    for (let x = 0; x < cloudy.width; x += 1) {
      const index = (y * cloudy.width + x) * 3
      const delta = Math.abs(cloudy.pixels[index] - clear.pixels[index]) + Math.abs(cloudy.pixels[index + 1] - clear.pixels[index + 1]) + Math.abs(cloudy.pixels[index + 2] - clear.pixels[index + 2])
      if (delta > 0.03) {
        changedPixels += 1
        if (y >= cloudy.height / 2) lowerHemisphereChanges += 1
      }
      if (x + 1 < cloudy.width && y < cloudy.height / 2) {
        const next = index + 3
        const edge = Math.abs(cloudy.pixels[index] - cloudy.pixels[next]) + Math.abs(cloudy.pixels[index + 1] - cloudy.pixels[next + 1]) + Math.abs(cloudy.pixels[index + 2] - cloudy.pixels[next + 2])
        if (edge > 0.025) localEdges += 1
      }
    }
  }
  assert.ok(changedPixels > 1000, `expected substantial cloud coverage, got ${changedPixels} changed pixels`)
  assert.ok(localEdges > 100, `expected small/medium cloud breakup, got ${localEdges} local edges`)
  assert.equal(lowerHemisphereChanges, 0)
  cloudy.dispose(); clear.dispose()
})

test('Step 10 cloud shading contains warm sun-facing and cool shadowed regions', () => {
  const cloudy = createProceduralSky(cloudOptions)
  const clear = createProceduralSky({ ...cloudOptions, cloudCoverage: 0 })
  let warm = 0
  let cool = 0
  for (let y = 0; y < cloudy.height / 2; y += 1) {
    for (let x = 0; x < cloudy.width; x += 1) {
      const index = (y * cloudy.width + x) * 3
      const delta = Math.abs(cloudy.pixels[index] - clear.pixels[index]) + Math.abs(cloudy.pixels[index + 1] - clear.pixels[index + 1]) + Math.abs(cloudy.pixels[index + 2] - clear.pixels[index + 2])
      if (delta <= 0.03) continue
      const redBlue = cloudy.pixels[index] - cloudy.pixels[index + 2]
      if (redBlue > 0.04) warm += 1
      if (redBlue < -0.04) cool += 1
    }
  }
  assert.ok(warm > 50, `expected warm cloud faces, got ${warm}`)
  assert.ok(cool > 200, `expected cool cloud shadows, got ${cool}`)
  cloudy.dispose(); clear.dispose()
})

test('Step 10 cloud quality reuses the existing environment resource instead of introducing cloud render systems', async () => {
  const source = await readFile(new URL('../packages/environment-authoring/src/ProceduralSky.ts', import.meta.url), 'utf8')
  assert.match(source, /sampleCloudLayer/)
  assert.match(source, /cloudField/)
  for (const forbidden of ['CloudRenderer', 'CloudEntity', 'CloudSystem', 'CloudPass', 'CloudNode']) assert.doesNotMatch(source, new RegExp(forbidden))
  const interfaceBlock = source.slice(source.indexOf('export interface ProceduralSkyOptions'), source.indexOf('/** Creates a deterministic HDR'))
  for (const existing of ['cloudCoverage', 'cloudDensity', 'cloudScale', 'cloudSeed']) assert.match(interfaceBlock, new RegExp(existing))
})

test('Step 10 representative 512x256 cloud generation remains bounded', () => {
  const started = performance.now()
  const sky = createProceduralSky({ ...cloudOptions, width: 512, height: 256 })
  const elapsed = performance.now() - started
  assert.equal(sky.pixels.length, 512 * 256 * 3)
  assert.ok(elapsed < 5000, `procedural cloud sky generation took ${elapsed.toFixed(1)}ms`)
  sky.dispose()
})
