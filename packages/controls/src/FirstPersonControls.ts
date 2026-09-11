import type { Camera } from '@sekai64-internal/cameras'
import { Vector3 } from '@sekai64-internal/math'
import { InputState } from './InputState.js'

export interface CollisionMover {
  move(position: Vector3, displacement: Vector3, deltaTime: number): Vector3
}

export interface FirstPersonControlsOptions {
  camera: Camera
  input?: InputState
  target?: EventTarget
  movementSpeed?: number
  sprintMultiplier?: number
  lookSpeed?: number
  minPitch?: number
  maxPitch?: number
  collision?: CollisionMover
}

export class FirstPersonControls {
  readonly camera: Camera
  readonly input: InputState
  readonly ownsInput: boolean
  movementSpeed: number
  sprintMultiplier: number
  lookSpeed: number
  minPitch: number
  maxPitch: number
  collision?: CollisionMover
  enabled = true
  disposed = false
  yaw: number
  pitch: number
  private readonly forward = new Vector3()
  private readonly right = new Vector3()
  private readonly displacement = new Vector3()

  constructor(options: FirstPersonControlsOptions) {
    this.camera = options.camera
    this.input = options.input ?? new InputState({ target: options.target, pointerTarget: options.target })
    this.ownsInput = !options.input
    this.movementSpeed = Math.max(0, options.movementSpeed ?? 4)
    this.sprintMultiplier = Math.max(1, options.sprintMultiplier ?? 1.8)
    this.lookSpeed = options.lookSpeed ?? 0.002
    this.minPitch = options.minPitch ?? -Math.PI / 2 + 0.01
    this.maxPitch = options.maxPitch ?? Math.PI / 2 - 0.01
    this.collision = options.collision

    // Preserve the camera's current viewing direction, then move it onto the
    // camera-friendly YXZ yaw/pitch convention used by interactive controls.
    this.camera.updateWorldFromRoot()
    const e = this.camera.localMatrix.elements
    this.forward.set(-(e[8] ?? 0), -(e[9] ?? 0), -(e[10] ?? 1)).normalize()
    this.yaw = Math.atan2(-this.forward.x, -this.forward.z)
    this.pitch = clamp(Math.asin(clamp(this.forward.y, -1, 1)), this.minPitch, this.maxPitch)
    this.camera.setViewAngles(this.pitch, this.yaw)
  }

  update(deltaTime: number): void {
    if (!this.enabled || this.disposed) { this.input.endFrame(); return }
    const lookX = clamp(this.input.pointerDelta.x, -240, 240) + this.input.virtualLook.x
    const lookY = clamp(this.input.pointerDelta.y, -240, 240) + this.input.virtualLook.y
    this.yaw -= lookX * this.lookSpeed
    this.pitch = clamp(this.pitch - lookY * this.lookSpeed, this.minPitch, this.maxPitch)
    this.camera.setViewAngles(this.pitch, this.yaw)

    const x = axis(this.input, ['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) + this.input.virtualMovement.x
    const z = axis(this.input, ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) - this.input.virtualMovement.y
    const length = Math.hypot(x, z)
    this.displacement.set(0, 0, 0)
    if (length > 0) {
      const normalizedX = x / Math.max(1, length)
      const normalizedZ = z / Math.max(1, length)
      this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
      const speed = this.movementSpeed * (this.input.isDown('ShiftLeft', 'ShiftRight') ? this.sprintMultiplier : 1)
      this.displacement.addScaledVector(this.forward, normalizedZ * speed * deltaTime)
      this.displacement.addScaledVector(this.right, normalizedX * speed * deltaTime)
      if (this.collision) this.camera.position.copy(this.collision.move(this.camera.position, this.displacement, deltaTime))
      else this.camera.position.add(this.displacement)
    } else if (this.collision) {
      this.camera.position.copy(this.collision.move(this.camera.position, this.displacement, deltaTime))
    }
    this.input.endFrame()
  }

  async requestPointerLock(element?: Element): Promise<void> {
    const target = element ?? (this.input as unknown as { pointerTarget?: Element }).pointerTarget
    if (target && 'requestPointerLock' in target) await (target as HTMLElement).requestPointerLock()
  }

  pause(): void { this.enabled = false }
  resume(): void { this.enabled = true }
  dispose(): void { if (this.disposed) return; this.disposed = true; if (this.ownsInput) this.input.dispose() }
}

function axis(input: InputState, positive: readonly string[], negative: readonly string[]): number {
  return (input.isDown(...positive) ? 1 : 0) - (input.isDown(...negative) ? 1 : 0)
}
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
