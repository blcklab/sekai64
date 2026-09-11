import { describe, expect, it } from 'vitest'
import { BasicMaterial } from './BasicMaterial.js'
import { StandardMaterial } from './StandardMaterial.js'
import { Texture } from './Texture.js'

 describe('Texture and StandardMaterial', () => {
  it('rejects unsafe protocols before decoding', async () => {
    const texture = new Texture({ source: 'javascript:alert(1)' })
    await expect(texture.load()).rejects.toThrow(/protocol/)
    texture.dispose()
  })

  it('enforces encoded loading limits', async () => {
    const texture = new Texture({ source: 'https://example.test/large.png' })
    await expect(texture.load({
      maxBytes: 2,
      fetch: async () => new Response(new Blob(['too large']), { status: 200 })
    })).rejects.toThrow(/loading limit/)
    texture.dispose()
  })

  it('supports explicit material sides and the double-sided alias', () => {
    const back = new BasicMaterial({ side: 'back' })
    expect(back.side).toBe('back')
    back.doubleSided = true
    expect(back.side).toBe('double')
    expect(back.doubleSided).toBe(true)
  })

  it('clamps material values and owns source-created textures', () => {
    const material = new StandardMaterial({
      baseColorTexture: 'data:image/png;base64,',
      autoloadTextures: false,
      metallic: 2,
      roughness: -1
    })
    const texture = material.baseColorTexture
    expect(material.metallic).toBe(1)
    expect(material.roughness).toBe(0)
    material.dispose()
    expect(texture?.disposed).toBe(true)
  })

  it('supports standalone PBR channels and bounded glass parameters', () => {
    const material = new StandardMaterial({
      metallicTexture: 'data:image/png;base64,',
      roughnessTexture: 'data:image/png;base64,',
      transmission: 2,
      ior: 9,
      thickness: -3,
      attenuationColor: '#88ccff',
      attenuationDistance: 0,
      autoloadTextures: false,
    })
    expect(material.metallicTexture).toBeDefined()
    expect(material.roughnessTexture).toBeDefined()
    expect(material.transmission).toBe(1)
    expect(material.ior).toBe(2.5)
    expect(material.thickness).toBe(0)
    expect(material.attenuationDistance).toBeGreaterThan(0)
    material.dispose()
  })


  it('uses VRM-friendly MToon defaults and character material roles', () => {
    const skin = new StandardMaterial({
      shadingModel: 'mtoon',
      character: { role: 'skin' },
      mtoon: { outlineWidthMode: 'none' },
    })
    expect(skin.mtoonShadingToony).toBe(0.9)
    expect(skin.mtoonGiEqualization).toBe(0.9)
    expect(skin.mtoonRimLightingMix).toBe(1)
    expect(skin.mtoonOutlineWidth).toBe(0)
    expect(skin.mtoonOcclusionMix).toBe(0.35)
    expect(skin.characterSoftLighting).toBeGreaterThan(0)

    const hair = new StandardMaterial({ shadingModel: 'mtoon', alphaMode: 'blend', character: { role: 'hair' } })
    expect(hair.mtoonHairAlphaDither).toBe(true)
    expect(hair.characterHairSpecularStrength).toBeGreaterThan(0)
  })

  it('supports bounded toon shading controls', () => {
    const material = new StandardMaterial({
      shadingModel: 'toon',
      toon: { shadeSteps: 99, shadowStrength: -1, rimPower: 99, outlineStrength: 2 },
    })
    expect(material.shadingModel).toBe('toon')
    expect(material.toonShadeSteps).toBe(8)
    expect(material.toonShadowStrength).toBe(0)
    expect(material.toonRimPower).toBe(12)
    expect(material.toonOutlineStrength).toBe(1)
  })

})
