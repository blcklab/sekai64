import { describe, expect, it } from 'vitest'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Mesh } from './Mesh.js'
import { Node, Scene } from './index.js'

describe('Scene graph', () => {
  it('propagates world transforms only after changes', () => {
    const scene = new Scene()
    const parent = new Node({ id: 'parent' })
    const child = new Node({ id: 'child' })
    parent.position.x = 2
    child.position.y = 3
    scene.add(parent)
    parent.add(child)
    scene.updateWorldMatrix()
    expect(child.worldMatrix.elements[12]).toBe(2)
    expect(child.worldMatrix.elements[13]).toBe(3)
    const version = child.worldVersion
    scene.updateWorldMatrix()
    expect(child.worldVersion).toBe(version)
    parent.position.z = 4
    scene.updateWorldMatrix()
    expect(child.worldVersion).toBe(version + 1)
  })

  it('rejects duplicate IDs', () => {
    const scene = new Scene()
    scene.add(new Node({ id: 'same' }))
    expect(() => scene.add(new Node({ id: 'same' }))).toThrow(/Duplicate/)
  })

  it('propagates visibility changes without requiring a transform mutation', () => {
    const scene = new Scene()
    const parent = new Node({ id: 'visible-parent' })
    const child = new Node({ id: 'visible-child' })
    scene.add(parent)
    parent.add(child)
    scene.updateWorldMatrix()
    parent.visible = false
    scene.updateWorldMatrix()
    expect(parent.worldVisible).toBe(false)
    expect(child.worldVisible).toBe(false)
  })
})

describe('Mesh resource replacement', () => {
  it('disposes owned previous resources and owns replacements explicitly', () => {
    const firstGeometry = new BoxGeometry()
    const nextGeometry = new BoxGeometry()
    const firstMaterial = new BasicMaterial()
    const nextMaterial = new BasicMaterial()
    const mesh = new Mesh({ geometry: firstGeometry, material: firstMaterial, ownsResources: true })

    mesh.setGeometry(nextGeometry, { ownsResource: true })
    mesh.setMaterial(nextMaterial, { ownsResource: true })

    expect(firstGeometry.disposed).toBe(true)
    expect(firstMaterial.disposed).toBe(true)
    mesh.dispose()
    expect(nextGeometry.disposed).toBe(true)
    expect(nextMaterial.disposed).toBe(true)
  })

  it('does not dispose shared resources when ownership is false', () => {
    const geometry = new BoxGeometry()
    const material = new BasicMaterial()
    const mesh = new Mesh({ geometry, material })
    mesh.dispose()
    expect(geometry.disposed).toBe(false)
    expect(material.disposed).toBe(false)
    geometry.dispose()
    material.dispose()
  })
})
