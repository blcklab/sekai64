export type XRMode = 'immersive-vr' | 'immersive-ar' | 'inline'
export type XRReferenceSpaceType = 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded'
export type XREye = 'none' | 'left' | 'right'
export type XRSessionState = 'idle' | 'checking-support' | 'entering' | 'active' | 'exiting' | 'failed' | 'disposed'
export type XRHandedness = 'none' | 'left' | 'right'
export type XRTargetRayMode = 'gaze' | 'tracked-pointer' | 'screen'
export type XRButtonSemantic = 'select' | 'squeeze' | 'thumbstick' | 'touchpad' | 'primary' | 'secondary' | 'unknown'

export interface XRMatrixTransform { readonly matrix: Float32Array; readonly inverse: XRMatrixTransform }
export interface XRPoseLike { readonly transform: XRMatrixTransform }
export interface XRViewLike { readonly eye: XREye; readonly projectionMatrix: Float32Array; readonly transform: XRMatrixTransform }
export interface XRViewportLike { x:number;y:number;width:number;height:number }
export interface XRWebGLLayerOptionsLike { antialias?:boolean;alpha?:boolean;depth?:boolean;stencil?:boolean;framebufferScaleFactor?:number;ignoreDepthValues?:boolean }
export interface XRWebGLLayerLike { readonly framebuffer?:WebGLFramebuffer|null;readonly framebufferWidth?:number;readonly framebufferHeight?:number;getViewport(view:XRViewLike):XRViewportLike|null }
export interface XRViewerPoseLike extends XRPoseLike { readonly views: readonly XRViewLike[] }
export interface XRSpaceLike {}
export interface XRReferenceSpaceLike extends EventTarget { getOffsetReferenceSpace?(originOffset: unknown): XRReferenceSpaceLike }
export interface XRHitTestSourceLike { cancel():void }
export interface XRHitTestResultLike { getPose(baseSpace:XRReferenceSpaceLike): XRPoseLike | null; createAnchor?():Promise<unknown> }
export interface XRFrameLike {
  readonly session:XRSessionLike
  getViewerPose(space:XRReferenceSpaceLike):XRViewerPoseLike|null
  getPose?(space:XRSpaceLike,baseSpace:XRReferenceSpaceLike):XRPoseLike|null
  getHitTestResults?(source:XRHitTestSourceLike):readonly XRHitTestResultLike[]
}
export interface XRInputSourceLike {
  readonly handedness:XRHandedness
  readonly targetRayMode:XRTargetRayMode
  readonly profiles:readonly string[]
  readonly targetRaySpace:XRSpaceLike
  readonly gripSpace?:XRSpaceLike
  readonly gamepad?:Gamepad
  readonly hand?:unknown
}
export interface XRSessionLike extends EventTarget {
  readonly inputSources:readonly XRInputSourceLike[]
  readonly renderState:{baseLayer?:XRWebGLLayerLike}
  requestReferenceSpace(type:XRReferenceSpaceType):Promise<XRReferenceSpaceLike>
  requestAnimationFrame(callback:(time:number,frame:XRFrameLike)=>void):number
  cancelAnimationFrame(handle:number):void
  updateRenderState(state:Readonly<Record<string,unknown>>):Promise<void>|void
  requestHitTestSource?(options:{space:XRReferenceSpaceLike}):Promise<XRHitTestSourceLike>
  end():Promise<void>
}
export interface XRSystemLike {
  isSessionSupported(mode:XRMode):Promise<boolean>
  requestSession(mode:XRMode,options?:{requiredFeatures?:string[];optionalFeatures?:string[];domOverlay?:{root:Element}}):Promise<XRSessionLike>
}

export interface XRPlayerRigTransform {
  readonly position: readonly [number, number, number]
  readonly yaw: number
}

export interface XRTransformSnapshot {
  readonly matrix: Float32Array
  readonly position: readonly [number, number, number]
  readonly direction: readonly [number, number, number]
}

export interface XRButtonSnapshot {
  readonly index: number
  readonly semantic: XRButtonSemantic
  readonly pressed: boolean
  readonly touched: boolean
  readonly value: number
}

export interface XRInputSnapshot {
  readonly id: string
  readonly handedness: XRHandedness
  readonly targetRayMode: XRTargetRayMode
  readonly profiles: readonly string[]
  readonly targetRay: XRTransformSnapshot | null
  readonly grip: XRTransformSnapshot | null
  readonly buttons: readonly XRButtonSnapshot[]
  readonly axes: readonly number[]
  readonly supportsHaptics: boolean
  readonly hand?: unknown
}

export interface XRViewerSnapshot extends XRTransformSnapshot {
  readonly timestamp: number
}
