export type ColorInput = string | number | readonly [number, number, number] | readonly [number, number, number, number] | Color

export class Color {
  constructor(public r = 1, public g = 1, public b = 1, public a = 1) {}

  set(input: ColorInput): this {
    if (input instanceof Color) return this.copy(input)
    if (typeof input === 'number') return this.setHex(input)
    if (typeof input === 'string') return this.setStyle(input)
    return this.setRGBA(input[0], input[1], input[2], input[3] ?? 1)
  }
  setRGBA(r: number, g: number, b: number, a = 1): this { this.r = r; this.g = g; this.b = b; this.a = a; return this }
  setHex(hex: number): this { return this.setRGBA(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, 1) }
  setStyle(style: string): this {
    const value = style.trim()
    const short = /^#([0-9a-f]{3,4})$/i.exec(value)
    if (short) {
      const text = short[1] ?? ''
      return this.setRGBA(
        parseInt((text[0] ?? '0') + (text[0] ?? '0'), 16) / 255,
        parseInt((text[1] ?? '0') + (text[1] ?? '0'), 16) / 255,
        parseInt((text[2] ?? '0') + (text[2] ?? '0'), 16) / 255,
        text[3] ? parseInt(text[3] + text[3], 16) / 255 : 1
      )
    }
    const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value)
    if (long) {
      const rgb = parseInt(long[1] ?? 'ffffff', 16)
      const alpha = long[2] ? parseInt(long[2], 16) / 255 : 1
      return this.setHex(rgb).setRGBA(this.r, this.g, this.b, alpha)
    }
    throw new Error(`Unsupported color value: ${style}`)
  }
  copy(value: Color): this { return this.setRGBA(value.r, value.g, value.b, value.a) }
  clone(): Color { return new Color(this.r, this.g, this.b, this.a) }
  toArray(target: number[] | Float32Array = [], offset = 0): number[] | Float32Array {
    target[offset] = this.r; target[offset + 1] = this.g; target[offset + 2] = this.b; target[offset + 3] = this.a; return target
  }
  static from(input: ColorInput): Color { return new Color().set(input) }
}
