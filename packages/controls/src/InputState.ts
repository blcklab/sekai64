import { EventDispatcher } from '@sekai64-internal/core'
import { Vector2 } from '@sekai64-internal/math'

export interface InputSnapshot {
  readonly keys: ReadonlySet<string>
  readonly buttons: ReadonlySet<number>
  readonly pointerDelta: readonly [number, number]
  readonly wheelDelta: number
  readonly movement: readonly [number, number]
  readonly look: readonly [number, number]
  readonly pointerLocked: boolean
}

interface InputEvents {
  action: { type: 'keydown' | 'keyup' | 'pointerdown' | 'pointerup' | 'wheel'; code?: string; button?: number; delta?: number }
}

export interface InputStateOptions {
  target?: EventTarget
  pointerTarget?: EventTarget
  preventDefault?: boolean
}

export class InputState extends EventDispatcher<InputEvents> {
  disposed = false
  readonly keys = new Set<string>()
  readonly buttons = new Set<number>()
  readonly pointerDelta = new Vector2()
  readonly virtualMovement = new Vector2()
  readonly virtualLook = new Vector2()
  wheelDelta = 0
  pointerLocked = false
  private readonly target?: EventTarget
  private readonly pointerTarget?: EventTarget
  private readonly preventDefault: boolean

  constructor(options: InputStateOptions = {}) {
    super()
    this.target = options.target ?? (typeof window !== 'undefined' ? window : undefined)
    this.pointerTarget = options.pointerTarget ?? this.target
    this.preventDefault = options.preventDefault ?? false
    this.attach()
  }

  isDown(...codes: readonly string[]): boolean { return codes.some(code => this.keys.has(code)) }
  setVirtualMovement(x: number, y: number): void { this.virtualMovement.set(clamp(x), clamp(y)) }
  setVirtualLook(x: number, y: number): void { this.virtualLook.set(x, y) }
  clearVirtualInput(): void { this.virtualMovement.set(0, 0); this.virtualLook.set(0, 0) }

  snapshot(resetTransient = true): InputSnapshot {
    const snapshot: InputSnapshot = {
      keys: new Set(this.keys), buttons: new Set(this.buttons),
      pointerDelta: [this.pointerDelta.x, this.pointerDelta.y], wheelDelta: this.wheelDelta,
      movement: [this.virtualMovement.x, this.virtualMovement.y],
      look: [this.virtualLook.x, this.virtualLook.y], pointerLocked: this.pointerLocked
    }
    if (resetTransient) this.endFrame()
    return snapshot
  }

  endFrame(): void { this.pointerDelta.set(0, 0); this.wheelDelta = 0; this.virtualLook.set(0, 0) }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    this.keys.clear(); this.buttons.clear(); this.clearVirtualInput(); this.endFrame(); this.clearListeners()
  }

  private attach(): void {
    this.target?.addEventListener('keydown', this.onKeyDown as EventListener)
    this.target?.addEventListener('keyup', this.onKeyUp as EventListener)
    this.target?.addEventListener('blur', this.onBlur as EventListener)
    this.pointerTarget?.addEventListener('pointerdown', this.onPointerDown as EventListener)
    this.pointerTarget?.addEventListener('pointerup', this.onPointerUp as EventListener)
    this.pointerTarget?.addEventListener('pointercancel', this.onPointerCancel as EventListener)
    this.pointerTarget?.addEventListener('lostpointercapture', this.onLostPointerCapture as EventListener)
    this.pointerTarget?.addEventListener('pointermove', this.onPointerMove as EventListener)
    this.pointerTarget?.addEventListener('wheel', this.onWheel as EventListener, { passive: !this.preventDefault })
    if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', this.onPointerLockChange)
  }

  private detach(): void {
    this.target?.removeEventListener('keydown', this.onKeyDown as EventListener)
    this.target?.removeEventListener('keyup', this.onKeyUp as EventListener)
    this.target?.removeEventListener('blur', this.onBlur as EventListener)
    this.pointerTarget?.removeEventListener('pointerdown', this.onPointerDown as EventListener)
    this.pointerTarget?.removeEventListener('pointerup', this.onPointerUp as EventListener)
    this.pointerTarget?.removeEventListener('pointercancel', this.onPointerCancel as EventListener)
    this.pointerTarget?.removeEventListener('lostpointercapture', this.onLostPointerCapture as EventListener)
    this.pointerTarget?.removeEventListener('pointermove', this.onPointerMove as EventListener)
    this.pointerTarget?.removeEventListener('wheel', this.onWheel as EventListener)
    if (typeof document !== 'undefined') document.removeEventListener('pointerlockchange', this.onPointerLockChange)
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => { this.keys.add(event.code); if (this.preventDefault) event.preventDefault(); this.emit('action', { type: 'keydown', code: event.code }) }
  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); if (this.preventDefault) event.preventDefault(); this.emit('action', { type: 'keyup', code: event.code }) }
  private readonly onPointerDown = (event: PointerEvent): void => {
    this.buttons.add(event.button)
    const target = event.currentTarget
    if (target && 'setPointerCapture' in target) {
      try { (target as Element).setPointerCapture(event.pointerId) } catch { /* unsupported/capture already lost */ }
    }
    this.emit('action', { type: 'pointerdown', button: event.button })
  }
  private readonly onPointerUp = (event: PointerEvent): void => {
    this.buttons.delete(event.button)
    const target = event.currentTarget
    if (target && 'releasePointerCapture' in target) {
      try { (target as Element).releasePointerCapture(event.pointerId) } catch { /* capture may already be released */ }
    }
    this.emit('action', { type: 'pointerup', button: event.button })
  }
  private readonly onPointerCancel = (): void => { this.buttons.clear(); this.pointerDelta.set(0, 0) }
  private readonly onLostPointerCapture = (): void => { this.buttons.clear(); this.pointerDelta.set(0, 0) }
  private readonly onPointerMove = (event: PointerEvent): void => { this.pointerDelta.x += event.movementX; this.pointerDelta.y += event.movementY }
  private readonly onWheel = (event: WheelEvent): void => { this.wheelDelta += event.deltaY; if (this.preventDefault) event.preventDefault(); this.emit('action', { type: 'wheel', delta: event.deltaY }) }
  private readonly onBlur = (): void => { this.keys.clear(); this.buttons.clear() }
  private readonly onPointerLockChange = (): void => { this.pointerLocked = typeof document !== 'undefined' && document.pointerLockElement !== null }
}

function clamp(value: number): number { return Math.max(-1, Math.min(1, value)) }
