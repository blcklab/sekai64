import { Camera, type CameraOptions } from './Camera.js'

export interface OrthographicCameraOptions extends CameraOptions {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export class OrthographicCamera extends Camera {
  private _left: number
  private _right: number
  private _top: number
  private _bottom: number

  constructor(options: OrthographicCameraOptions = {}) {
    super(options)
    this._left = options.left ?? -1
    this._right = options.right ?? 1
    this._top = options.top ?? 1
    this._bottom = options.bottom ?? -1
    this.validate()
  }

  get left(): number { return this._left }
  set left(value: number) { this._left = value; this.validate(); this.markProjectionDirty() }
  get right(): number { return this._right }
  set right(value: number) { this._right = value; this.validate(); this.markProjectionDirty() }
  get top(): number { return this._top }
  set top(value: number) { this._top = value; this.validate(); this.markProjectionDirty() }
  get bottom(): number { return this._bottom }
  set bottom(value: number) { this._bottom = value; this.validate(); this.markProjectionDirty() }

  protected updateProjectionMatrix(): void {
    this.projectionMatrix.makeOrthographic(this._left, this._right, this._top, this._bottom, this.near, this.far)
  }

  private validate(): void {
    if (this._left === this._right || this._top === this._bottom) throw new Error('Orthographic camera bounds must have non-zero size.')
  }
}
