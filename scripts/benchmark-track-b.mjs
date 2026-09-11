import { performance } from 'node:perf_hooks'
import { generateRgba8MipChain } from '@sekai64-internal/texture-tools'
import { createProceduralSky, prefilterEnvironment, packPrefilteredEnvironment } from '@sekai64-internal/environment-authoring'
import { createIdentityColorLut, packColorLutStrip, sampleColorLut } from '@sekai64-internal/renderer'

function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? 0 }
function measure(label, iterations, fn) {
  const values = []
  for (let index = 0; index < iterations; index += 1) { const started = performance.now(); fn(); values.push(performance.now() - started) }
  return { label, iterations, medianMs: median(values), minMs: Math.min(...values), maxMs: Math.max(...values) }
}

const pixels = new Uint8Array(1024 * 1024 * 4)
for (let index = 0; index < pixels.length; index += 4) {
  const value = (index / 4) % 251
  pixels[index] = value; pixels[index + 1] = 255 - value; pixels[index + 2] = (value * 3) % 255; pixels[index + 3] = value > 96 ? 255 : 0
}
const results = []
results.push(measure('1K sRGB alpha-preserving mip chain', 5, () => generateRgba8MipChain(1024, 1024, pixels, { srgb: true, alphaCoverageCutoff: 0.5 })))
results.push(measure('256x128 procedural HDR sky', 5, () => { const sky = createProceduralSky({ width: 256, height: 128, cloudCoverage: 0.25, seed: 7 }); sky.dispose() }))
const source = createProceduralSky({ width: 128, height: 64, cloudCoverage: 0.2, seed: 11 })
results.push(measure('32px IBL prefilter (16 samples)', 3, () => prefilterEnvironment(source, { diffuseWidth: 8, specularWidth: 32, levels: 6, sampleCount: 16 })))
const filtered = prefilterEnvironment(source, { diffuseWidth: 8, specularWidth: 32, levels: 6, sampleCount: 16 })
results.push(measure('IBL sRGB mip packing', 10, () => packPrefilteredEnvironment(filtered)))
const lut = createIdentityColorLut(32)
results.push(measure('32^3 LUT strip packing', 10, () => packColorLutStrip(lut)))
results.push(measure('100K trilinear LUT samples', 3, () => { for (let i = 0; i < 100000; i += 1) sampleColorLut(lut, [(i % 997) / 996, (i % 503) / 502, (i % 251) / 250]) }))
source.dispose()

console.log(JSON.stringify({
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  note: 'CPU authoring/reference measurements only. These are not browser GPU frame-time benchmarks.',
  results,
}, null, 2))
