import { StandardMaterial, type StandardMaterialOptions, type WaterShadingOptions } from './StandardMaterial.js'

export interface WaterMaterialOptions extends Omit<StandardMaterialOptions, 'shadingModel' | 'water'>, WaterShadingOptions {}

/**
 * Stylized physically-inspired water preset.
 *
 * The renderer keeps this as a StandardMaterial-compatible surface so water
 * benefits from ordinary normal maps, environment reflections, transmission,
 * texture residency, culling, instancing and recovery.
 */
export class WaterMaterial extends StandardMaterial {
  constructor(options: WaterMaterialOptions = {}) {
    super({
      baseColor: options.baseColor ?? options.shallowColor ?? '#55b8d6',
      metallic: options.metallic ?? 0,
      roughness: options.roughness ?? 0.12,
      transmission: options.transmission ?? 0.82,
      ior: options.ior ?? 1.333,
      thickness: options.thickness ?? 1.5,
      attenuationColor: options.attenuationColor ?? options.deepColor ?? '#0a3f67',
      attenuationDistance: options.attenuationDistance ?? 4,
      alphaMode: options.alphaMode ?? 'blend',
      depthWrite: options.depthWrite ?? false,
      side: options.side ?? 'double',
      ...options,
      shadingModel: 'water',
      water: options,
    })
  }
}
