import { Material, type MaterialOptions } from './Material.js'

export type UniformValue = number | readonly number[] | Float32Array

export interface ShaderMaterialOptions extends MaterialOptions {
  wgsl?: { vertex: string; fragment: string }
  glsl?: { vertex: string; fragment: string }
  uniforms?: Readonly<Record<string, UniformValue>>
}

export class ShaderMaterial extends Material {
  readonly wgsl?: Readonly<{ vertex: string; fragment: string }>
  readonly glsl?: Readonly<{ vertex: string; fragment: string }>
  readonly uniforms: Map<string, UniformValue>

  constructor(options: ShaderMaterialOptions) {
    super(options)
    if (!options.wgsl && !options.glsl) throw new Error('ShaderMaterial requires WGSL or GLSL source.')
    this.wgsl = options.wgsl
    this.glsl = options.glsl
    this.uniforms = new Map(Object.entries(options.uniforms ?? {}))
  }

  setUniform(name: string, value: UniformValue): this { this.uniforms.set(name, value); this.markChanged(); return this }
}

export function wgsl(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  return strings.reduce((result, part, index) => result + part + (index < values.length ? String(values[index]) : ''), '')
}

export function glsl(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  return wgsl(strings, ...values)
}
