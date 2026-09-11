import { EnvironmentResource, type EnvironmentResourceOptions } from './EnvironmentResource.js'

export function decodeRadianceHdr(data: ArrayBuffer, options: Omit<EnvironmentResourceOptions, 'width' | 'height' | 'pixels'>): EnvironmentResource {
  const bytes = new Uint8Array(data)
  const text = new TextDecoder('ascii').decode(bytes)
  const headerEnd = text.indexOf('\n\n')
  if (headerEnd < 0 || !text.startsWith('#?RADIANCE')) throw new Error('Invalid Radiance HDR header.')
  const resolutionStart = headerEnd + 2
  const resolutionEnd = text.indexOf('\n', resolutionStart)
  if (resolutionEnd < 0) throw new Error('Radiance HDR resolution line is missing.')
  const resolution = text.slice(resolutionStart, resolutionEnd).trim()
  const match = /^-Y\s+(\d+)\s+\+X\s+(\d+)$/i.exec(resolution)
  if (!match) throw new Error(`Unsupported Radiance HDR orientation: ${resolution}`)
  const height = Number(match[1]), width = Number(match[2])
  const pixels = decodePixels(bytes, resolutionEnd + 1, width, height)
  return new EnvironmentResource({ ...options, width, height, pixels })
}

function decodePixels(bytes: Uint8Array, start: number, width: number, height: number): Float32Array {
  const output = new Float32Array(width * height * 3)
  let offset = start
  for (let y = 0; y < height; y += 1) {
    if (width >= 8 && width <= 0x7fff && bytes[offset] === 2 && bytes[offset + 1] === 2 && (((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) === width) {
      offset += 4
      const scanline = new Uint8Array(width * 4)
      for (let channel = 0; channel < 4; channel += 1) {
        let x = 0
        while (x < width) {
          const code = bytes[offset++] ?? 0
          if (code > 128) { const count = code - 128, value = bytes[offset++] ?? 0; scanline.fill(value, channel * width + x, channel * width + x + count); x += count }
          else { const count = code; for (let index = 0; index < count; index += 1) scanline[channel * width + x++] = bytes[offset++] ?? 0 }
        }
      }
      for (let x = 0; x < width; x += 1) writeRgbe(output, (y * width + x) * 3, scanline[x] ?? 0, scanline[width + x] ?? 0, scanline[width * 2 + x] ?? 0, scanline[width * 3 + x] ?? 0)
    } else {
      for (let x = 0; x < width; x += 1) writeRgbe(output, (y * width + x) * 3, bytes[offset++] ?? 0, bytes[offset++] ?? 0, bytes[offset++] ?? 0, bytes[offset++] ?? 0)
    }
  }
  return output
}
function writeRgbe(target: Float32Array, offset: number, r: number, g: number, b: number, exponent: number): void { const scale = exponent === 0 ? 0 : Math.pow(2, exponent - 136); target[offset] = r * scale; target[offset + 1] = g * scale; target[offset + 2] = b * scale }
