import { describe, expect, it } from 'vitest'
import { Geometry } from '@sekai64-internal/geometry'
import { Mesh, Node } from '@sekai64-internal/scene'
import { BasicMaterial } from '@sekai64-internal/materials'
import { AnimationClip, AnimationMixer, AnimationTrack, SkeletonResource, SkinnedGeometry } from './index.js'

describe('Sekai64 animation module', () => {
  it('samples clips and updates nodes', () => {
    const root = new Node({ id: 'root' })
    const child = new Node({ id: 'child' })
    root.add(child)
    const clip = new AnimationClip({ id: 'move', tracks: [new AnimationTrack({ target: 'child', path: 'translation', times: new Float32Array([0, 1]), values: new Float32Array([0, 0, 0, 2, 0, 0]) })] })
    const mixer = new AnimationMixer(root, [clip])
    mixer.play('move', { loop: 'once' })
    mixer.update(0.5)
    expect(child.position.x).toBeCloseTo(1)
  })

  it('deforms morph targets without changing the base source', () => {
    const geometry = new SkinnedGeometry({ positions: new Float32Array([0, 0, 0]), morphTargets: [{ name: 'up', positions: new Float32Array([0, 1, 0]) }] })
    geometry.setMorphWeight('up', 0.5).deform()
    expect(geometry.positions[1]).toBeCloseTo(0.5)
    expect(geometry.basePositions[1]).toBe(0)
  })

  it('creates joint palettes', () => {
    const joint = new Node({ id: 'joint' })
    joint.position.x = 1
    const skeleton = new SkeletonResource({ id: 's', joints: [joint] })
    expect(skeleton.palette[12]).toBeCloseTo(1)
  })

  it('remains compatible with ordinary meshes', () => {
    const geometry = new Geometry({ positions: new Float32Array([0, 0, 0]) })
    const mesh = new Mesh({ geometry, material: new BasicMaterial(), ownsResources: true })
    expect(mesh.geometry).toBe(geometry)
  })
})
