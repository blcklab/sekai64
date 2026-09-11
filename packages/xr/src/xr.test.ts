import { describe, expect, it } from 'vitest'
import { Scene } from '@sekai64-internal/scene'
import { XRViewCamera } from './XRViewCamera.js'
import { XRWebGLLayerBridge } from './XRWebGLLayerBridge.js'

describe('XRWebGLLayerBridge', () => {
  it('renders both XR eye viewports', async () => {
    const previous = (globalThis as typeof globalThis & { XRWebGLLayer?: unknown }).XRWebGLLayer
    class Layer { framebuffer=null; getViewport(){return {x:0,y:0,width:10,height:10}} }
    ;(globalThis as typeof globalThis & { XRWebGLLayer?: unknown }).XRWebGLLayer = Layer
    const calls: unknown[] = []
    const renderer = { getContext:()=>({} as WebGL2RenderingContext), makeXRCompatible:async()=>{}, renderViewport:(...args:unknown[])=>calls.push(args) }
    const session = { renderState:{} as Record<string,unknown>, inputSources:[], updateRenderState(state:Record<string,unknown>){Object.assign(this.renderState,state)} }
    const bridge = new XRWebGLLayerBridge(renderer)
    await bridge.initialize(session as never)
    const left=new XRViewCamera('left'),right=new XRViewCamera('right')
    bridge.render(new Scene(), {session,views:[left,right]} as never)
    expect(calls).toHaveLength(2)
    bridge.dispose()
    ;(globalThis as typeof globalThis & { XRWebGLLayer?: unknown }).XRWebGLLayer = previous
  })
})
