import { Matrix4, Vector3 } from '@sekai64-internal/math'
import { Node, type NodeOptions } from '@sekai64-internal/scene'

export interface CameraOptions extends NodeOptions {
  near?: number
  far?: number
}

export abstract class Camera extends Node {
  readonly projectionMatrix = new Matrix4()
  readonly viewMatrix = new Matrix4()
  readonly viewProjectionMatrix = new Matrix4()
  private projectionDirty = true
  protected _near: number
  protected _far: number
  private readonly lookAtTarget = new Vector3()
  private readonly lookAtDirection = new Vector3()
  private readonly parentInverse = new Matrix4()

  protected constructor(options: CameraOptions = {}) {
    super(options)
    this._near = options.near ?? 0.1
    this._far = options.far ?? 1000
    this.validateClipping()
  }

  get near(): number { return this._near }
  set near(value: number) { this._near = value; this.validateClipping(); this.markProjectionDirty() }
  get far(): number { return this._far }
  set far(value: number) { this._far = value; this.validateClipping(); this.markProjectionDirty() }

  /**
   * Sets a camera-friendly yaw/pitch/roll orientation.
   *
   * Cameras look down local -Z. YXZ keeps yaw around Y and pitch around X
   * independent, avoiding the sideways gimbal behaviour caused by using XYZ
   * as a first/third-person view orientation.
   */
  setViewAngles(pitch: number, yaw: number, roll = 0): this {
    this.rotation.set(pitch, yaw, roll, 'YXZ')
    return this
  }

  /**
   * Points local -Z at a target while keeping the camera horizon stable.
   * The target is interpreted in world space; parented camera rigs are
   * handled by transforming that target into the parent's local space.
   */
  lookAt(target: Vector3 | readonly [number, number, number]): this {
    if (Array.isArray(target)) this.lookAtTarget.fromArray(target)
    else this.lookAtTarget.copy(target as Vector3)

    if (this.parent) {
      this.parent.updateWorldFromRoot()
      this.parentInverse.copy(this.parent.worldMatrix).invert()
      this.lookAtTarget.applyMatrix4(this.parentInverse)
    }

    this.lookAtDirection.subVectors(this.lookAtTarget, this.position)
    const lengthSquared = this.lookAtDirection.lengthSquared()
    if (lengthSquared <= 1e-16) return this
    this.lookAtDirection.normalize()

    const horizontal = Math.hypot(this.lookAtDirection.x, this.lookAtDirection.z)
    const pitch = Math.atan2(this.lookAtDirection.y, Math.max(horizontal, 1e-12))
    const yaw = horizontal > 1e-12
      ? Math.atan2(-this.lookAtDirection.x, -this.lookAtDirection.z)
      : this.rotation.y

    return this.setViewAngles(pitch, yaw, 0)
  }

  /** Returns the camera's world-space local -Z viewing direction. */
  getWorldDirection(target = new Vector3()): Vector3 {
    this.updateWorldFromRoot()
    const e = this.worldMatrix.elements
    return target.set(-(e[8] ?? 0), -(e[9] ?? 0), -(e[10] ?? 1)).normalize()
  }

  updateMatrices(): void {
    this.updateWorldFromRoot()
    if (this.projectionDirty) {
      this.updateProjectionMatrix()
      this.projectionDirty = false
    }
    this.viewMatrix.copy(this.worldMatrix).invert()
    this.viewProjectionMatrix.multiplyMatrices(this.projectionMatrix, this.viewMatrix)
  }

  updateViewport(_width: number, _height: number): void {}

  protected markProjectionDirty(): void { this.projectionDirty = true }
  protected abstract updateProjectionMatrix(): void

  private validateClipping(): void {
    if (!(this._near > 0) || !(this._far > this._near)) throw new Error('Camera clipping range requires 0 < near < far.')
  }
}
