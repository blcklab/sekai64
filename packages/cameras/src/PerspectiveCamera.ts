import { Camera, type CameraOptions } from './Camera.js'

export interface PerspectiveCameraOptions extends CameraOptions {
  fieldOfView?: number
  aspect?: number
  autoAspect?: boolean
}

export class PerspectiveCamera extends Camera {
  private _fieldOfView: number
  private _aspect: number
  autoAspect: boolean

  constructor(options: PerspectiveCameraOptions = {}) {
    super(options)
    this._fieldOfView = options.fieldOfView ?? 60
    this._aspect = options.aspect ?? 1
    this.autoAspect = options.autoAspect ?? true
    this.validate()
  }

  get fieldOfView(): number { return this._fieldOfView }
  set fieldOfView(value: number) { this._fieldOfView = value; this.validate(); this.markProjectionDirty() }
  get aspect(): number { return this._aspect }
  set aspect(value: number) { this._aspect = value; this.validate(); this.markProjectionDirty() }

  override updateViewport(width: number, height: number): void {
    if (this.autoAspect && height > 0) this.aspect = width / height
  }

  protected updateProjectionMatrix(): void {
    this.projectionMatrix.makePerspective((this._fieldOfView * Math.PI) / 180, this._aspect, this.near, this.far)
  }

  private validate(): void {
    if (!(this._fieldOfView > 0 && this._fieldOfView < 180)) throw new Error('Perspective fieldOfView must be between 0 and 180 degrees.')
    if (!(this._aspect > 0)) throw new Error('Perspective aspect must be greater than zero.')
  }
}
