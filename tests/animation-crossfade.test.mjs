import assert from 'node:assert/strict'
import test from 'node:test'
import { Node } from '@blcklab/sekai64'
import { AnimationClip, AnimationMixer, AnimationTrack } from '@blcklab/sekai64/animation'

function translationClip(id, from, to) {
  return new AnimationClip({
    id,
    tracks: [new AnimationTrack({
      target: 'child',
      path: 'translation',
      times: new Float32Array([0, 1]),
      values: new Float32Array([from, 0, 0, to, 0, 0]),
    })],
  })
}

test('zero-weight crossfade target fades in and advances instead of staying invisible', () => {
  const root = new Node({ id: 'root' })
  const child = new Node({ id: 'child' })
  root.add(child)
  const idle = translationClip('idle', 0, 0)
  const walk = translationClip('walk', 0, 2)
  const mixer = new AnimationMixer(root, [idle, walk])

  const idleAction = mixer.play('idle', { loop: 'repeat' })
  mixer.update(0.1)

  const walkAction = idleAction.crossFadeTo('walk', { duration: 0.2 })
  assert.equal(walkAction.weight, 0)

  mixer.update(0.1)
  assert.ok(walkAction.weight > 0, 'incoming action must leave zero weight on the first fade frame')
  assert.ok(walkAction.time > 0, 'incoming action must begin advancing while it fades in')

  mixer.update(0.1)
  assert.ok(walkAction.weight > 0.99, 'incoming action must complete its fade to full weight')
  assert.equal(idleAction.finished, true, 'outgoing action should stop after fading out')
  assert.ok(child.position.x > 0, 'incoming clip must visibly drive the target pose')
})

test('walk to idle crossfade activates idle rather than freezing the last walk pose', () => {
  const root = new Node({ id: 'root' })
  const child = new Node({ id: 'child' })
  root.add(child)
  const idle = translationClip('idle', 0, 0)
  const walk = translationClip('walk', 0, 2)
  const mixer = new AnimationMixer(root, [idle, walk])

  const walkAction = mixer.play('walk', { loop: 'repeat' })
  mixer.update(0.5)
  assert.ok(child.position.x > 0.9)

  const idleAction = walkAction.crossFadeTo('idle', { duration: 0.2 })
  mixer.update(0.1)
  assert.ok(idleAction.weight > 0)
  mixer.update(0.1)

  assert.ok(idleAction.weight > 0.99)
  assert.equal(walkAction.finished, true)
  assert.ok(Math.abs(child.position.x) < 1e-6, 'idle must own the pose after movement stops')
})
