import { Camera } from '@sekai64-internal/cameras'
import { Matrix4 } from '@sekai64-internal/math'
import type { XREye, XRViewLike, XRViewportLike } from './types.js'

export class XRViewCamera extends Camera {
  eye: XREye = 'none'
  viewport: XRViewportLike = {x:0,y:0,width:1,height:1}
  readonly xrProjectionMatrix = new Matrix4()
  private readonly nativeWorldMatrix = new Matrix4()

  constructor(eye:XREye='none'){super({id:`xr-camera-${eye}`,near:0.01,far:1000});this.eye=eye}

  setFromXRView(view:XRViewLike,viewport?:XRViewportLike|null,playerRig?:Matrix4):this{
    this.eye=view.eye
    this.projectionMatrix.elements.set(view.projectionMatrix)
    this.xrProjectionMatrix.copy(this.projectionMatrix)
    this.nativeWorldMatrix.elements.set(view.transform.matrix)
    if(playerRig)this.worldMatrix.multiplyMatrices(playerRig,this.nativeWorldMatrix)
    else this.worldMatrix.copy(this.nativeWorldMatrix)
    this.viewMatrix.copy(this.worldMatrix).invert()
    this.viewProjectionMatrix.multiplyMatrices(this.projectionMatrix,this.viewMatrix)
    if(viewport)this.viewport={...viewport}
    return this
  }
  override updateMatrices():void{}
  protected updateProjectionMatrix():void{}
}
