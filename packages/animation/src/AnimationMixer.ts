import { EventDispatcher } from '@sekai64-internal/core'
import { Quaternion } from '@sekai64-internal/math'
import { Mesh, type Node } from '@sekai64-internal/scene'
import { AnimationClip, type AnimationMarker, type AnimationTrackPath } from './AnimationClip.js'
import { SkinnedGeometry } from './SkinnedGeometry.js'

export type AnimationLoopMode = 'once' | 'repeat' | 'ping-pong'
export interface AnimationPlayOptions { loop?: AnimationLoopMode; speed?: number; weight?: number; startTime?: number; enabled?: boolean }
export interface AnimationCrossFadeOptions { duration: number }
interface MixerEvents {
  marker: { action: AnimationAction; marker: AnimationMarker }
  complete: { action: AnimationAction }
}

export class AnimationAction {
  time = 0
  speed: number
  weight: number
  enabled: boolean
  paused = false
  loop: AnimationLoopMode
  direction = 1
  finished = false
  private fade?: { from: number; to: number; duration: number; elapsed: number }

  constructor(readonly mixer: AnimationMixer, readonly clip: AnimationClip, options: AnimationPlayOptions = {}) {
    this.loop = options.loop ?? 'repeat'
    this.speed = options.speed ?? 1
    this.weight = options.weight ?? 1
    this.time = Math.max(0, options.startTime ?? 0)
    this.enabled = options.enabled ?? true
  }
  pause(): this { this.paused = true; return this }
  resume(): this { this.paused = false; return this }
  stop(): this { this.enabled = false; this.finished = true; return this }
  seek(time: number): this { this.time = Math.max(0, Math.min(this.clip.duration, time)); this.finished = false; return this }
  setWeight(weight: number): this { this.weight = Math.max(0, weight); this.fade = undefined; return this }
  fadeTo(weight: number, duration: number): this { this.fade = { from: this.weight, to: Math.max(0, weight), duration: Math.max(0, duration), elapsed: 0 }; return this }
  crossFadeTo(clip: string | AnimationClip, options: AnimationCrossFadeOptions): AnimationAction {
    const target = this.mixer.play(clip, { weight: 0, loop: this.loop, speed: this.speed })
    this.fadeTo(0, options.duration)
    target.fadeTo(1, options.duration)
    return target
  }
  updateFade(delta: number): void {
    if (!this.fade) return
    this.fade.elapsed += delta
    const alpha = this.fade.duration === 0 ? 1 : Math.min(1, this.fade.elapsed / this.fade.duration)
    this.weight = this.fade.from + (this.fade.to - this.fade.from) * alpha
    if (alpha >= 1) { const target = this.fade.to; this.fade = undefined; if (target === 0) this.stop() }
  }
}

interface PoseAccumulator { path: AnimationTrackPath; target: Node; values: Float32Array; weight: number; rotation?: Quaternion }

export class AnimationMixer extends EventDispatcher<MixerEvents> {
  readonly clips = new Map<string, AnimationClip>()
  readonly actions: AnimationAction[] = []
  timeScale = 1
  private readonly nodes = new Map<string, Node>()

  constructor(readonly root: Node, clips: readonly AnimationClip[] = []) {
    super()
    this.reindex()
    for (const clip of clips) this.addClip(clip)
  }

  reindex(): this {
    this.nodes.clear()
    this.root.traverse(node => {
      if (node.id) this.nodes.set(node.id, node)
      if (node.name && !this.nodes.has(node.name)) this.nodes.set(node.name, node)
    })
    return this
  }

  addClip(clip: AnimationClip): this {
    if (this.clips.has(clip.id)) throw new Error(`Animation clip is already registered: ${clip.id}`)
    this.clips.set(clip.id, clip)
    return this
  }

  play(clip: string | AnimationClip, options: AnimationPlayOptions = {}): AnimationAction {
    const resolved = typeof clip === 'string' ? this.clips.get(clip) : clip
    if (!resolved) throw new Error(`Animation clip is not registered: ${String(clip)}`)
    if (!this.clips.has(resolved.id)) this.addClip(resolved)
    const action = new AnimationAction(this, resolved, options)
    this.actions.push(action)
    return action
  }

  stopAll(): void { for (const action of this.actions) action.stop(); this.actions.length = 0 }

  update(deltaTime: number): void {
    const delta = Math.max(0, deltaTime) * this.timeScale
    const accumulators = new Map<string, PoseAccumulator>()
    for (const action of this.actions) {
      if (!action.enabled || action.paused || action.finished) continue

      // Fade progression must happen before the weight gate. Cross-fade targets are
      // intentionally created at weight 0, so skipping zero-weight actions first
      // leaves the incoming action permanently invisible. Re-check lifecycle after
      // the fade because an outgoing action can reach weight 0 and stop this frame.
      action.updateFade(delta)
      if (!action.enabled || action.finished || action.weight <= 0) continue

      const previous = action.time
      advanceAction(action, delta, marker => this.emit('marker', { action, marker }), () => this.emit('complete', { action }))
      for (const track of action.clip.tracks) {
        const target = this.nodes.get(track.target)
        if (!target) continue
        const sample = track.sample(action.time)
        const key = `${track.target}:${track.path}`
        let accumulator = accumulators.get(key)
        if (!accumulator) {
          accumulator = { path: track.path, target, values: new Float32Array(track.valueSize), weight: 0 }
          accumulators.set(key, accumulator)
        }
        if (track.path === 'rotation') {
          const sampled = new Quaternion().fromArray(sample)
          if (!accumulator.rotation) accumulator.rotation = sampled
          else accumulator.rotation.slerp(sampled, action.weight / Math.max(1e-8, accumulator.weight + action.weight))
        } else {
          for (let component = 0; component < sample.length; component += 1) accumulator.values[component] = (accumulator.values[component] ?? 0) + (sample[component] ?? 0) * action.weight
        }
        accumulator.weight += action.weight
      }
      void previous
    }
    for (const accumulator of accumulators.values()) applyPose(accumulator)
    for (let index = this.actions.length - 1; index >= 0; index -= 1) if (this.actions[index]?.finished) this.actions.splice(index, 1)
  }
}

function advanceAction(
  action: AnimationAction,
  delta: number,
  onMarker: (marker: AnimationMarker) => void,
  onComplete: () => void,
): void {
  const duration = action.clip.duration
  if (duration <= 0) return
  const previous = action.time
  action.time += delta * action.speed * action.direction
  if (action.loop === 'once') {
    if (action.time >= duration || action.time <= 0) {
      action.time = action.direction >= 0 ? duration : 0
      action.finished = true
      onComplete()
    }
  } else if (action.loop === 'repeat') {
    while (action.time >= duration) action.time -= duration
    while (action.time < 0) action.time += duration
  } else {
    if (action.time >= duration) { action.time = duration - (action.time - duration); action.direction = -1 }
    else if (action.time <= 0) { action.time = -action.time; action.direction = 1 }
  }
  emitCrossedMarkers(action.clip.markers, previous, action.time, action.direction, duration, action.loop, onMarker)
}

function emitCrossedMarkers(
  markers: readonly AnimationMarker[],
  previous: number,
  current: number,
  direction: number,
  duration: number,
  loop: AnimationLoopMode,
  emit: (marker: AnimationMarker) => void,
): void {
  if (direction >= 0) {
    if (loop === 'repeat' && current < previous) {
      for (const marker of markers) if (marker.time > previous || marker.time <= current) emit(marker)
    } else for (const marker of markers) if (marker.time > previous && marker.time <= current) emit(marker)
  } else {
    if (loop === 'repeat' && current > previous) {
      for (const marker of [...markers].reverse()) if (marker.time < previous || marker.time >= current) emit(marker)
    } else for (const marker of [...markers].reverse()) if (marker.time < previous && marker.time >= current) emit(marker)
  }
  void duration
}

function applyPose(accumulator: PoseAccumulator): void {
  const weight = accumulator.weight || 1
  if (accumulator.path === 'translation') accumulator.target.position.set((accumulator.values[0] ?? 0) / weight, (accumulator.values[1] ?? 0) / weight, (accumulator.values[2] ?? 0) / weight)
  else if (accumulator.path === 'scale') accumulator.target.scale.set((accumulator.values[0] ?? 1) / weight, (accumulator.values[1] ?? 1) / weight, (accumulator.values[2] ?? 1) / weight)
  else if (accumulator.path === 'rotation' && accumulator.rotation) accumulator.target.rotation.setFromQuaternion(accumulator.rotation)
  else if (accumulator.path === 'weights' && accumulator.target instanceof Mesh && accumulator.target.geometry instanceof SkinnedGeometry) {
    const values = accumulator.values.map(value => value / weight)
    accumulator.target.geometry.setMorphWeights(values)
  }
}
