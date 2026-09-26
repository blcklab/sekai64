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

import { PlaneGeometry } from '@sekai64-internal/geometry'
import { Matrix4 } from '@sekai64-internal/math'
import { ParticleEmitter } from './ParticleEmitter.js'

class TestBillboardCamera {
  readonly worldMatrix = new Matrix4()
  updateWorldFromRoot(): void {}
}

describe('ParticleEmitter', () => {
  it('uses deterministic typed-array initial state and compact active draw counts', () => {
    const geometry = new PlaneGeometry()
    const material = new BasicMaterial({ transparent: true })
    const options = {
      geometry,
      material,
      seed: 8127,
      maxParticles: 32,
      emissionRate: 0,
      burst: 8,
      lifetime: { min: 2, max: 4 },
      spawnShape: { type: 'box' as const, size: [5, 1, 5] as const },
      velocity: { min: [-0.2, 0.3, -0.2] as const, max: [0.2, 1, 0.2] as const },
      size: { min: 0.02, max: 0.08 },
      quality: 'ultra' as const,
    }
    const first = new ParticleEmitter(options)
    const second = new ParticleEmitter(options)
    const camera = new TestBillboardCamera()
    first.update(0, camera)
    second.update(0, camera)

    expect(first.activeParticles).toBe(8)
    expect(first.drawCount).toBe(8)
    expect(Array.from(first.positions.slice(0, 24))).toEqual(Array.from(second.positions.slice(0, 24)))
    expect(Array.from(first.velocities.slice(0, 24))).toEqual(Array.from(second.velocities.slice(0, 24)))
    expect(Array.from(first.lifetimes.slice(0, 8))).toEqual(Array.from(second.lifetimes.slice(0, 8)))
    expect(Array.from(first.particleSizes.slice(0, 8))).toEqual(Array.from(second.particleSizes.slice(0, 8)))
    expect(first.positions).toBeInstanceOf(Float32Array)
    expect(first.velocities).toBeInstanceOf(Float32Array)

    first.reset().update(0, camera)
    expect(Array.from(first.positions.slice(0, 24))).toEqual(Array.from(second.positions.slice(0, 24)))
    first.dispose(); second.dispose(); geometry.dispose(); material.dispose()
  })

  it('supports point, box, sphere, and surface spawn shapes with renderer-owned quality budgets', () => {
    const camera = new TestBillboardCamera()
    for (const spawnShape of [
      { type: 'point' as const },
      { type: 'box' as const, size: [2, 3, 4] as const },
      { type: 'sphere' as const, radius: 2 },
      { type: 'surface' as const, size: [3, 1, 5] as const },
    ]) {
      const geometry = new PlaneGeometry()
      const material = new BasicMaterial({ transparent: true })
      const emitter = new ParticleEmitter({ geometry, material, maxParticles: 100, burst: 100, spawnShape, quality: 'low', importance: 0.5 })
      emitter.update(0, camera)
      expect(emitter.activeParticles).toBe(emitter.budgetParticles)
      expect(emitter.activeParticles).toBeLessThan(100)
      expect(emitter.drawCount).toBe(emitter.activeParticles)
      emitter.quality = 'ultra'
      expect(emitter.budgetParticles).toBeGreaterThan(emitter.activeParticles)
      emitter.dispose(); geometry.dispose(); material.dispose()
    }
  })

  it('simulates force, drag, lifetime, and camera-facing billboards without per-particle nodes', () => {
    const geometry = new PlaneGeometry()
    const material = new BasicMaterial({ transparent: true })
    const emitter = new ParticleEmitter({
      geometry,
      material,
      seed: 4,
      maxParticles: 4,
      burst: 1,
      lifetime: { min: 1, max: 1 },
      velocity: { min: [1, 0, 0], max: [1, 0, 0] },
      gravity: [0, -1, 0],
      drag: 0.1,
      size: { min: 0.5, max: 0.5 },
      rotation: { min: 0, max: 0 },
      quality: 'ultra',
    })
    const camera = new TestBillboardCamera()
    emitter.update(0, camera)
    expect(emitter.children).toHaveLength(0)
    emitter.update(0.5, camera)
    expect(emitter.positions[0]).toBeGreaterThan(0)
    expect(emitter.positions[1]).toBeLessThan(0)
    expect(emitter.instanceMatrices[0]).toBeCloseTo(0.5)
    expect(emitter.instanceMatrices[5]).toBeCloseTo(0.5)
    emitter.update(0.5, camera)
    expect(emitter.activeParticles).toBe(0)
    emitter.dispose(); geometry.dispose(); material.dispose()
  })
})
