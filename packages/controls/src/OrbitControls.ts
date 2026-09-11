import type { Camera } from '@sekai64-internal/cameras'
import { Vector3 } from '@sekai64-internal/math'
import { InputState } from './InputState.js'

export interface OrbitControlsOptions {
  camera: Camera
  target?: Vector3 | readonly [number, number, number]
  input?: InputState
  eventTarget?: EventTarget
  rotateSpeed?: number
  zoomSpeed?: number
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  damping?: number
}

export class OrbitControls {
  readonly camera: Camera
  readonly input: InputState
  readonly ownsInput: boolean
  readonly target = new Vector3()
  rotateSpeed: number
  zoomSpeed: number
  minDistance: number
  maxDistance: number
  minPolarAngle: number
  maxPolarAngle: number
  damping: number
  enabled = true
  disposed = false
  private radius = 1
  private azimuth = 0
  private polar = Math.PI / 2
  private azimuthVelocity = 0
  private polarVelocity = 0
  private zoomVelocity = 0
  private readonly offset = new Vector3()

  constructor(options: OrbitControlsOptions) {
    this.camera = options.camera
    this.input = options.input ?? new InputState({ target: options.eventTarget, pointerTarget: options.eventTarget })
    this.ownsInput = !options.input
    if (Array.isArray(options.target)) this.target.fromArray(options.target)
    else if (options.target) this.target.copy(options.target as Vector3)
    this.rotateSpeed = options.rotateSpeed ?? 0.003
    this.zoomSpeed = options.zoomSpeed ?? 0.001
    this.minDistance = Math.max(0.001, options.minDistance ?? 0.1)
    this.maxDistance = Math.max(this.minDistance, options.maxDistance ?? 1000)
    this.minPolarAngle = options.minPolarAngle ?? 0.01
    this.maxPolarAngle = options.maxPolarAngle ?? Math.PI - 0.01
    this.damping = clamp(options.damping ?? 0.15, 0, 1)
    this.syncFromCamera()
    this.camera.lookAt(this.target)
  }

  syncFromCamera(): void {
    this.offset.subVectors(this.camera.position, this.target)
    this.radius = Math.max(this.minDistance, this.offset.length())
    this.azimuth = Math.atan2(this.offset.x, this.offset.z)
    this.polar = Math.acos(clamp(this.offset.y / this.radius, -1, 1))
    this.azimuthVelocity = 0
    this.polarVelocity = 0
    this.zoomVelocity = 0
  }

  /** Current camera distance from the orbit target. */
  getDistance(): number { return this.radius }

  /**
   * Move the orbit target while preserving the current viewing direction.
   * Supplying a distance also performs a deterministic dolly, which is useful
   * for inspect cameras, character focus points, and asset-viewer close-ups.
   */
  focus(target: Vector3 | readonly [number, number, number], distance = this.radius): void {
    if (this.disposed) return
    this.offset.subVectors(this.camera.position, this.target)
    if (this.offset.lengthSquared() < 1e-12) {
      const sinPolar = Math.sin(this.polar)
      this.offset.set(
        sinPolar * Math.sin(this.azimuth),
        Math.cos(this.polar),
        sinPolar * Math.cos(this.azimuth),
      )
    } else this.offset.normalize()
    if (Array.isArray(target)) this.target.fromArray(target)
    else this.target.copy(target as Vector3)
    this.radius = clamp(Number.isFinite(distance) ? distance : this.radius, this.minDistance, this.maxDistance)
    this.camera.position.copy(this.target).addScaledVector(this.offset, this.radius)
    this.camera.lookAt(this.target)
    this.syncFromCamera()
  }

  /** Dolly to an absolute target distance without changing the focus point. */
  setDistance(distance: number): void {
    if (this.disposed) return
    this.radius = clamp(Number.isFinite(distance) ? distance : this.radius, this.minDistance, this.maxDistance)
    const sinPolar = Math.sin(this.polar)
    this.camera.position.set(
      this.target.x + this.radius * sinPolar * Math.sin(this.azimuth),
      this.target.y + this.radius * Math.cos(this.polar),
      this.target.z + this.radius * sinPolar * Math.cos(this.azimuth),
    )
    this.camera.lookAt(this.target)
    this.stopMotion()
  }

  update(deltaTime = 0): void {
    if (!this.enabled || this.disposed) { this.input.endFrame(); return }

    // Clamp long-frame spikes so a resumed tab or a single noisy pointer event
    // cannot fling the camera across the scene.
    const dt = clamp(deltaTime > 0 && Number.isFinite(deltaTime) ? deltaTime : 1 / 60, 1 / 240, 0.1)
    const rotating = this.input.buttons.has(0) || this.input.pointerLocked
    const pointerX = clamp(this.input.pointerDelta.x, -160, 160)
    const pointerY = clamp(this.input.pointerDelta.y, -160, 160)

    if (rotating) {
      // Pointer motion maps directly to angle. Velocity is sampled only for
      // release inertia; it is never accumulated while dragging.
      const azimuthDelta = -pointerX * this.rotateSpeed
      const requestedPolarDelta = -pointerY * this.rotateSpeed
      const previousPolar = this.polar
      this.azimuth += azimuthDelta
      this.polar = clamp(this.polar + requestedPolarDelta, this.minPolarAngle, this.maxPolarAngle)
      this.azimuthVelocity = azimuthDelta / dt
      this.polarVelocity = (this.polar - previousPolar) / dt
    } else {
      this.azimuth += this.azimuthVelocity * dt
      const previousPolar = this.polar
      this.polar = clamp(this.polar + this.polarVelocity * dt, this.minPolarAngle, this.maxPolarAngle)
      if (this.polar === previousPolar && Math.abs(this.polarVelocity) > 0) this.polarVelocity = 0
    }

    const wheel = clamp(this.input.wheelDelta, -240, 240)
    if (wheel !== 0) {
      const zoomDelta = wheel * this.zoomSpeed * Math.max(1, this.radius)
      const previousRadius = this.radius
      this.radius = clamp(this.radius + zoomDelta, this.minDistance, this.maxDistance)
      this.zoomVelocity = (this.radius - previousRadius) / dt
    } else {
      const previousRadius = this.radius
      this.radius = clamp(this.radius + this.zoomVelocity * dt, this.minDistance, this.maxDistance)
      if (this.radius === previousRadius && Math.abs(this.zoomVelocity) > 0) this.zoomVelocity = 0
    }

    const sinPolar = Math.sin(this.polar)
    this.camera.position.set(
      this.target.x + this.radius * sinPolar * Math.sin(this.azimuth),
      this.target.y + this.radius * Math.cos(this.polar),
      this.target.z + this.radius * sinPolar * Math.cos(this.azimuth)
    )
    this.camera.lookAt(this.target)

    // Preserve the old damping meaning at 60 Hz while making it independent
    // of actual render frame rate.
    const retained = Math.pow(1 - this.damping, dt * 60)
    this.azimuthVelocity *= retained
    this.polarVelocity *= retained
    this.zoomVelocity *= retained
    if (Math.abs(this.azimuthVelocity) < 1e-5) this.azimuthVelocity = 0
    if (Math.abs(this.polarVelocity) < 1e-5) this.polarVelocity = 0
    if (Math.abs(this.zoomVelocity) < 1e-5) this.zoomVelocity = 0
    this.input.endFrame()
  }

  pause(): void { this.enabled = false; this.stopMotion() }
  resume(): void { this.enabled = true }
  stopMotion(): void { this.azimuthVelocity = 0; this.polarVelocity = 0; this.zoomVelocity = 0 }
  dispose(): void { if (this.disposed) return; this.disposed = true; if (this.ownsInput) this.input.dispose() }
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
