import { Texture } from './Texture.js'

export type TextHorizontalAlign = 'left' | 'center' | 'right'
export type TextVerticalAlign = 'top' | 'middle' | 'bottom'

export interface TextTextureOptions {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  color?: string
  background?: string
  padding?: number
  width?: number
  height?: number
  maxWidth?: number
  align?: TextHorizontalAlign
  verticalAlign?: TextVerticalAlign
  pixelRatio?: number
  /** Maximum generated canvas width or height. Defaults to 4096 pixels. */
  maxDimension?: number
  label?: string
}

/** Rasterizes system-font text without adding a font or layout dependency. */
export function createTextTexture(text: string, options: TextTextureOptions = {}): Texture {
  const fontSize = Math.max(1, options.fontSize ?? 48)
  const lineHeight = Math.max(fontSize, options.lineHeight ?? fontSize * 1.2)
  const padding = Math.max(0, options.padding ?? Math.ceil(fontSize * 0.2))
  const requestedPixelRatio = Math.max(0.25, options.pixelRatio ?? 1)
  const maxDimension = Math.max(1, options.maxDimension ?? 4096)
  const lines = String(text).split(/\r?\n/)
  const measureCanvas = createCanvas(1, 1)
  const measure = get2dContext(measureCanvas)
  const font = `${options.fontStyle ?? 'normal'} ${options.fontWeight ?? 600} ${fontSize}px ${options.fontFamily ?? 'system-ui, sans-serif'}`
  measure.font = font
  const naturalWidth = Math.max(1, ...lines.map(line => measure.measureText(line || ' ').width)) + padding * 2
  const logicalWidth = Math.max(1, Math.ceil(options.width ?? Math.min(options.maxWidth ?? Number.POSITIVE_INFINITY, naturalWidth)))
  const logicalHeight = Math.max(1, Math.ceil(options.height ?? lines.length * lineHeight + padding * 2))
  const pixelRatio = Math.min(requestedPixelRatio, maxDimension / logicalWidth, maxDimension / logicalHeight)
  const canvas = createCanvas(Math.max(1, Math.ceil(logicalWidth * pixelRatio)), Math.max(1, Math.ceil(logicalHeight * pixelRatio)))
  const context = get2dContext(canvas)
  context.scale(pixelRatio, pixelRatio)
  context.clearRect(0, 0, logicalWidth, logicalHeight)
  if (options.background) { context.fillStyle = options.background; context.fillRect(0, 0, logicalWidth, logicalHeight) }
  context.font = font
  context.textBaseline = 'middle'
  context.textAlign = options.align ?? 'center'
  context.fillStyle = options.color ?? '#ffffff'
  const blockHeight = lines.length * lineHeight
  const startY = options.verticalAlign === 'top'
    ? padding + lineHeight / 2
    : options.verticalAlign === 'bottom'
      ? logicalHeight - padding - blockHeight + lineHeight / 2
      : (logicalHeight - blockHeight) / 2 + lineHeight / 2
  const x = options.align === 'left' ? padding : options.align === 'right' ? logicalWidth - padding : logicalWidth / 2
  lines.forEach((line, index) => context.fillText(line, x, startY + index * lineHeight, Math.max(1, logicalWidth - padding * 2)))
  return new Texture({ source: canvas, label: options.label ?? `text:${text.slice(0, 24)}`, flipY: true, colorSpace: 'srgb' })
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas }
  throw new Error('Text texture creation requires OffscreenCanvas or a browser document.')
}

function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A 2D canvas context is unavailable.')
  return context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}
