import { EventDispatcher } from '@sekai64-internal/core'
import { Euler, Matrix4, Vector3 } from '@sekai64-internal/math'
import { XRViewCamera } from './XRViewCamera.js'
import type {
  XRButtonSemantic,
  XRButtonSnapshot,
  XRFrameLike,
  XRHitTestResultLike,
  XRHitTestSourceLike,
  XRInputSnapshot,
  XRInputSourceLike,
  XRMode,
  XRPlayerRigTransform,
  XRReferenceSpaceLike,
  XRReferenceSpaceType,
  XRSessionLike,
  XRSessionState,
  XRSystemLike,
  XRTransformSnapshot,
  XRViewerSnapshot,
} from './types.js'

export interface XRSessionOptions {
  requiredFeatures?:readonly string[]
  optionalFeatures?:readonly string[]
  referenceSpace?:XRReferenceSpaceType
  referenceSpaceFallbacks?:readonly XRReferenceSpaceType[]
  domOverlayRoot?:Element
}

export interface XRFrameState {
  time:number
  frame:XRFrameLike
  session:XRSessionLike
  referenceSpace:XRReferenceSpaceLike
  views:readonly XRViewCamera[]
  inputSources:readonly XRInputSourceLike[]
  inputs:readonly XRInputSnapshot[]
  viewer:XRViewerSnapshot|null
}

interface XREvents {
  statechange:{previous:XRSessionState;state:XRSessionState}
  sessionstart:{mode:XRMode;session:XRSessionLike}
  sessionend:{mode:XRMode}
  inputsourceschange:{sources:readonly XRInputSourceLike[];inputs:readonly XRInputSnapshot[]}
  referencespacereset:{referenceSpace:XRReferenceSpaceLike}
  trackinglost:undefined
  trackingrestored:undefined
  frame:XRFrameState
  error:{error:unknown}
}

const BUTTON_SEMANTICS: readonly XRButtonSemantic[] = [
  'select',
  'squeeze',
  'touchpad',
  'thumbstick',
  'primary',
  'secondary',
]

function referenceSpaceCandidates(
  requested: XRReferenceSpaceType,
  fallbacks: readonly XRReferenceSpaceType[] = [],
): readonly XRReferenceSpaceType[] {
  const defaults: readonly XRReferenceSpaceType[] = requested === 'bounded-floor'
    ? ['local-floor', 'local']
    : requested === 'local-floor'
      ? ['local']
      : []
  return [...new Set([requested, ...fallbacks, ...defaults])]
}

function transformSnapshot(matrixLike: Float32Array, rig?: Matrix4): XRTransformSnapshot {
  const native = new Matrix4()
  native.elements.set(matrixLike)
  const matrix = rig ? new Matrix4().multiplyMatrices(rig, native) : native
  const e = matrix.elements
  const dx = -(e[8] ?? 0)
  const dy = -(e[9] ?? 0)
  const dz = -(e[10] ?? 1)
  const length = Math.hypot(dx, dy, dz) || 1
  return {
    matrix: new Float32Array(e),
    position: [e[12] ?? 0, e[13] ?? 0, e[14] ?? 0],
    direction: [dx / length, dy / length, dz / length],
  }
}

function gamepadButtons(gamepad: Gamepad | undefined): readonly XRButtonSnapshot[] {
  return Array.from(gamepad?.buttons ?? [], (button, index) => ({
    index,
    semantic: BUTTON_SEMANTICS[index] ?? 'unknown',
    pressed: Boolean(button.pressed),
    touched: Boolean(button.touched),
    value: Number.isFinite(button.value) ? button.value : 0,
  }))
}

function supportsHaptics(gamepad: Gamepad | undefined): boolean {
  if (!gamepad) return false
  const extended = gamepad as Gamepad & { hapticActuators?: readonly unknown[]; vibrationActuator?: unknown }
  return Boolean(extended.vibrationActuator || extended.hapticActuators?.length)
}

export class XRSessionManager extends EventDispatcher<XREvents> {
  session?:XRSessionLike
  referenceSpace?:XRReferenceSpaceLike
  referenceSpaceType?:XRReferenceSpaceType
  mode?:XRMode
  running=false
  disposed=false
  readonly views=[new XRViewCamera('left'),new XRViewCamera('right')]

  private frameHandle?:number
  private callback?: (state:XRFrameState)=>void
  private hitTestSource?:XRHitTestSourceLike
  private currentState:XRSessionState='idle'
  private tracking=true
  private readonly playerRigMatrix=new Matrix4()
  private playerRig:XRPlayerRigTransform={position:[0,0,0],yaw:0}
  private viewer:XRViewerSnapshot|null=null
  private inputs:readonly XRInputSnapshot[]=[]
  private readonly inputIds=new WeakMap<object,string>()
  private nextInputId=1

  static get system():XRSystemLike|undefined{return typeof navigator!=='undefined'?(navigator as Navigator & {xr?:XRSystemLike}).xr:undefined}

  static async isSupported(mode:XRMode):Promise<boolean>{
    const system=this.system
    if(!system)return false
    try{return await system.isSessionSupported(mode)}catch{return false}
  }

  get state():XRSessionState{return this.currentState}
  get viewerPose():XRViewerSnapshot|null{return this.viewer?{...this.viewer,matrix:new Float32Array(this.viewer.matrix)}:null}
  get inputSnapshots():readonly XRInputSnapshot[]{return this.inputs.map(input=>({...input,targetRay:input.targetRay?{...input.targetRay,matrix:new Float32Array(input.targetRay.matrix)}:null,grip:input.grip?{...input.grip,matrix:new Float32Array(input.grip.matrix)}:null,buttons:input.buttons.map(button=>({...button})),axes:[...input.axes],profiles:[...input.profiles]}))}
  get playerRigTransform():XRPlayerRigTransform{return{position:[...this.playerRig.position] as [number,number,number],yaw:this.playerRig.yaw}}

  async checkSupport(mode:XRMode):Promise<boolean>{
    this.assertAlive()
    const previous=this.currentState
    this.setState('checking-support')
    const supported=await XRSessionManager.isSupported(mode)
    if(this.currentState==='checking-support')this.setState(previous==='failed'?'idle':previous)
    return supported
  }

  async requestSession(mode:XRMode,options:XRSessionOptions={}):Promise<XRSessionLike>{
    this.assertAlive()
    if(this.session||this.currentState==='entering'||this.currentState==='active'||this.currentState==='exiting')throw new Error('An XR session is already active or changing state.')
    if(typeof isSecureContext!=='undefined'&&!isSecureContext)throw new Error('Immersive WebXR requires a secure context (HTTPS or localhost).')
    const system=XRSessionManager.system
    if(!system)throw new Error('WebXR is unavailable in this browser.')

    this.setState('checking-support')
    let supported=false
    try{supported=await system.isSessionSupported(mode)}catch(error){this.fail(error);throw error}
    if(!supported){const error=new Error(`WebXR mode is unsupported: ${mode}`);this.fail(error);throw error}

    this.setState('entering')
    const requestedReferenceSpace=options.referenceSpace??(mode==='immersive-vr'?'local-floor':'local')
    const candidates=referenceSpaceCandidates(requestedReferenceSpace,options.referenceSpaceFallbacks)
    const requiredFeatures=[...new Set(options.requiredFeatures??[])]
    const referenceSpaceFeatures=candidates.filter(candidate=>candidate!=='viewer'&&candidate!=='local')
    const optionalFeatures=[...new Set([
      ...(options.optionalFeatures??[]),
      ...referenceSpaceFeatures,
      ...(options.domOverlayRoot?['dom-overlay']:[]),
    ])].filter(feature=>!requiredFeatures.includes(feature))
    let session:XRSessionLike|undefined
    try{
      session=await system.requestSession(mode,{requiredFeatures,optionalFeatures,...(options.domOverlayRoot?{domOverlay:{root:options.domOverlayRoot}}:{})})
      let referenceSpace:XRReferenceSpaceLike|undefined
      let referenceSpaceType:XRReferenceSpaceType|undefined
      let referenceSpaceError:unknown
      for(const candidate of candidates){
        try{
          referenceSpace=await session.requestReferenceSpace(candidate)
          referenceSpaceType=candidate
          break
        }catch(error){referenceSpaceError=error}
      }
      if(!referenceSpace||!referenceSpaceType)throw referenceSpaceError??new Error(`Unable to acquire XR reference space: ${requestedReferenceSpace}`)
      if(this.disposed){await session.end().catch(()=>undefined);throw new Error('XRSessionManager was disposed while entering XR.')}
      this.session=session
      this.referenceSpace=referenceSpace
      this.referenceSpaceType=referenceSpaceType
      this.mode=mode
      session.addEventListener('end',this.onSessionEnd)
      session.addEventListener('inputsourceschange',this.onInputSourcesChange)
      referenceSpace.addEventListener?.('reset',this.onReferenceSpaceReset)
      this.inputs=this.createInputSnapshots(undefined)
      this.setState('active')
      this.emit('sessionstart',{mode,session})
      return session
    }catch(error){
      if(session&&session!==this.session)await session.end().catch(()=>undefined)
      this.cleanupSession(false)
      this.fail(error)
      throw error
    }
  }

  start(callback:(state:XRFrameState)=>void):void{
    this.assertAlive()
    if(!this.session||!this.referenceSpace)throw new Error('Request an XR session before starting the XR frame loop.')
    this.callback=callback
    if(this.running)return
    this.running=true
    this.scheduleFrame()
  }

  stop():void{
    this.running=false
    if(this.frameHandle!==undefined)this.session?.cancelAnimationFrame(this.frameHandle)
    this.frameHandle=undefined
    this.callback=undefined
  }

  async end():Promise<void>{
    if(!this.session)return
    const active=this.session
    this.setState('exiting')
    this.stop()
    try{await active.end()}finally{if(this.session===active)this.cleanupSession(true)}
  }

  setPlayerRigTransform(transform:XRPlayerRigTransform):void{
    this.assertAlive()
    const position:[number,number,number]=[
      Number.isFinite(transform.position[0])?transform.position[0]:0,
      Number.isFinite(transform.position[1])?transform.position[1]:0,
      Number.isFinite(transform.position[2])?transform.position[2]:0,
    ]
    const yaw=Number.isFinite(transform.yaw)?transform.yaw:0
    this.playerRig={position,yaw}
    this.playerRigMatrix.compose(new Vector3(...position),new Euler(0,yaw,0),new Vector3(1,1,1))
  }

  async enableHitTesting():Promise<void>{
    if(!this.session||!this.referenceSpace)throw new Error('An XR session is required for hit testing.')
    if(!this.session.requestHitTestSource)throw new Error('XR hit testing is unavailable in this browser.')
    this.hitTestSource?.cancel()
    this.hitTestSource=await this.session.requestHitTestSource({space:this.referenceSpace})
  }

  getHitTestResults(frame:XRFrameLike):readonly XRHitTestResultLike[]{return this.hitTestSource&&frame.getHitTestResults?frame.getHitTestResults(this.hitTestSource):[]}
  getPlacementMatrix(frame:XRFrameLike,index=0):Matrix4|null{const hit=this.getHitTestResults(frame)[index];const pose=hit?.getPose(this.referenceSpace as XRReferenceSpaceLike);if(!pose)return null;const native=new Matrix4().set(...pose.transform.matrix);return new Matrix4().multiplyMatrices(this.playerRigMatrix,native)}
  getPlacementPosition(frame:XRFrameLike,index=0,target=new Vector3()):Vector3|null{const matrix=this.getPlacementMatrix(frame,index);return matrix?target.setFromMatrixPosition(matrix):null}
  async createAnchor(frame:XRFrameLike,index=0):Promise<unknown>{const hit=this.getHitTestResults(frame)[index];if(!hit?.createAnchor)throw new Error('XR anchors are unavailable for this hit-test result.');return hit.createAnchor()}

  dispose():void{void this.disposeAsync()}
  async disposeAsync():Promise<void>{
    if(this.disposed)return
    this.disposed=true
    this.stop()
    this.hitTestSource?.cancel()
    this.hitTestSource=undefined
    try{if(this.session)await this.session.end()}catch(error){this.emit('error',{error})}
    this.cleanupSession(false)
    this.setState('disposed')
    this.clearListeners()
  }

  private scheduleFrame():void{
    if(!this.running||!this.session)return
    this.frameHandle=this.session.requestAnimationFrame(this.onFrame)
  }

  private readonly onFrame=(time:number,frame:XRFrameLike):void=>{
    if(!this.running||!this.session||!this.referenceSpace)return
    try{
      const pose=frame.getViewerPose(this.referenceSpace)
      if(!pose){
        this.viewer=null
        if(this.tracking){this.tracking=false;this.emit('trackinglost',undefined)}
        return
      }
      if(!this.tracking){this.tracking=true;this.emit('trackingrestored',undefined)}
      const layer=this.session.renderState.baseLayer
      pose.views.forEach((view,index)=>{
        const camera=this.views[index]??new XRViewCamera(view.eye)
        camera.setFromXRView(view,layer?.getViewport(view),this.playerRigMatrix)
        if(!this.views[index])this.views[index]=camera
      })
      this.viewer={...transformSnapshot(pose.transform.matrix,this.playerRigMatrix),timestamp:time}
      this.inputs=this.createInputSnapshots(frame)
      const state:XRFrameState={time,frame,session:this.session,referenceSpace:this.referenceSpace,views:this.views.slice(0,pose.views.length),inputSources:this.session.inputSources,inputs:this.inputs,viewer:this.viewer}
      this.callback?.(state)
      this.emit('frame',state)
    }catch(error){
      this.emit('error',{error})
    }finally{
      this.scheduleFrame()
    }
  }

  private createInputSnapshots(frame:XRFrameLike|undefined):readonly XRInputSnapshot[]{
    if(!this.session||!this.referenceSpace)return[]
    const referenceSpace=this.referenceSpace
    return this.session.inputSources.map(source=>{
      let id=this.inputIds.get(source as object)
      if(!id){id=`xr-input-${this.nextInputId++}`;this.inputIds.set(source as object,id)}
      const targetPose=frame?.getPose?.(source.targetRaySpace,referenceSpace)
      const gripPose=source.gripSpace?frame?.getPose?.(source.gripSpace,referenceSpace):null
      return{
        id,
        handedness:source.handedness,
        targetRayMode:source.targetRayMode,
        profiles:[...source.profiles],
        targetRay:targetPose?transformSnapshot(targetPose.transform.matrix,this.playerRigMatrix):null,
        grip:gripPose?transformSnapshot(gripPose.transform.matrix,this.playerRigMatrix):null,
        buttons:gamepadButtons(source.gamepad),
        axes:Array.from(source.gamepad?.axes??[]),
        supportsHaptics:supportsHaptics(source.gamepad),
        ...(source.hand!==undefined?{hand:source.hand}:{}),
      }
    })
  }

  private readonly onSessionEnd=():void=>{this.cleanupSession(true)}
  private readonly onInputSourcesChange=():void=>{this.inputs=this.createInputSnapshots(undefined);if(this.session)this.emit('inputsourceschange',{sources:this.session.inputSources,inputs:this.inputs})}
  private readonly onReferenceSpaceReset=():void=>{if(this.referenceSpace)this.emit('referencespacereset',{referenceSpace:this.referenceSpace})}

  private cleanupSession(emitEnd:boolean):void{
    const mode=this.mode
    const session=this.session
    const referenceSpace=this.referenceSpace
    this.stop()
    this.hitTestSource?.cancel()
    this.hitTestSource=undefined
    session?.removeEventListener('end',this.onSessionEnd)
    session?.removeEventListener('inputsourceschange',this.onInputSourcesChange)
    referenceSpace?.removeEventListener?.('reset',this.onReferenceSpaceReset)
    this.session=undefined
    this.referenceSpace=undefined
    this.referenceSpaceType=undefined
    this.mode=undefined
    this.viewer=null
    this.inputs=[]
    this.tracking=true
    if(!this.disposed)this.setState('idle')
    if(emitEnd&&mode)this.emit('sessionend',{mode})
  }

  private fail(error:unknown):void{this.setState('failed');this.emit('error',{error})}
  private setState(state:XRSessionState):void{if(this.currentState===state)return;const previous=this.currentState;this.currentState=state;this.emit('statechange',{previous,state})}
  private assertAlive():void{if(this.disposed||this.currentState==='disposed')throw new Error('XRSessionManager is disposed.')}
}
