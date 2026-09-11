import type { Camera } from '@sekai64-internal/cameras'
import type { Scene } from '@sekai64-internal/scene'
import type { XRFrameState } from './XRSessionManager.js'
import type { XRSessionLike, XRWebGLLayerLike, XRWebGLLayerOptionsLike, XRViewportLike } from './types.js'

export interface XRWebGLRendererLike {
  getContext(): WebGL2RenderingContext
  makeXRCompatible?(): Promise<void>
  renderViewport(
    scene: Scene,
    camera: Camera,
    viewport: XRViewportLike,
    options?: {
      framebuffer?: WebGLFramebuffer | null
      clear?: boolean
      updateScene?: boolean
      updateCamera?: boolean
      resetStats?: boolean
    }
  ): void
}

interface XRWebGLLayerConstructor {
  new(session: XRSessionLike, context: WebGL2RenderingContext, options?: XRWebGLLayerOptionsLike): XRWebGLLayerLike
}

export interface XRWebGLLayerBridgeOptions extends XRWebGLLayerOptionsLike {
  depthNear?: number
  depthFar?: number
}

/**
 * Connects a Sekai64 WebGL2 renderer to a WebXR session.
 *
 * WebGPU XR bindings are deliberately not hidden behind this class: browser
 * support is still uneven, so the stable v0.4 path uses WebGL2 and reports the
 * backend requirement explicitly.
 */
export class XRWebGLLayerBridge {
  readonly renderer: XRWebGLRendererLike
  layer?: XRWebGLLayerLike
  disposed = false

  constructor(renderer: XRWebGLRendererLike) {
    this.renderer = renderer
  }

  async initialize(session: XRSessionLike, options: XRWebGLLayerBridgeOptions = {}): Promise<XRWebGLLayerLike> {
    if (this.disposed) throw new Error('XRWebGLLayerBridge is disposed.')
    await this.renderer.makeXRCompatible?.()

    const Layer = (globalThis as typeof globalThis & { XRWebGLLayer?: XRWebGLLayerConstructor }).XRWebGLLayer
    if (!Layer) throw new Error('XRWebGLLayer is unavailable. Sekai64 XR currently requires a WebGL2 WebXR layer.')

    const { depthNear, depthFar, ...layerOptions } = options
    const layer = new Layer(session, this.renderer.getContext(), layerOptions)
    await session.updateRenderState({
      baseLayer: layer,
      ...(depthNear !== undefined ? { depthNear } : {}),
      ...(depthFar !== undefined ? { depthFar } : {})
    })
    this.layer = layer
    return layer
  }

  render(scene: Scene, state: XRFrameState): void {
    const layer = this.layer ?? state.session.renderState.baseLayer
    if (!layer) throw new Error('Initialize an XRWebGLLayerBridge before rendering XR frames.')

    state.views.forEach((camera, index) => {
      const viewport = camera.viewport
      this.renderer.renderViewport(scene, camera, viewport, {
        framebuffer: layer.framebuffer ?? null,
        clear: index === 0,
        updateScene: index === 0,
        updateCamera: false,
        resetStats: index === 0
      })
    })
  }

  dispose(): void {
    this.disposed = true
    this.layer = undefined
  }
}
