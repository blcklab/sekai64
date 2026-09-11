import type { Camera } from '@sekai64-internal/cameras'
import { EventDispatcher, ResourceManager } from '@sekai64-internal/core'
import type { ColorInput } from '@sekai64-internal/math'
import { RendererModuleHost, type RendererModule, type RendererRecoveryContext } from '@sekai64-internal/modules'
import type {
  PowerPreference,
  Renderer,
  RendererBackend,
  RendererCapabilities,
  RendererAtmosphere,
  RendererColorGrading,
  RendererColorManagement,
  RendererEnvironmentLighting,
  RendererImageQuality,
  RendererPostProcessing,
  RendererOptimizationOptions,
  RendererShadowOptions,
  RenderSurface,
} from '@sekai64-internal/renderer'
import type { Scene } from '@sekai64-internal/scene'
import { LoadedScene, loadSceneDefinition, type SceneDefinition, type SceneObjectFactory } from './json.js'

export interface RendererPreference {
  preferredBackend?: RendererBackend
  fallback?: RendererBackend | false
  powerPreference?: PowerPreference
}

export interface EngineOptions {
  canvas: RenderSurface | string
  renderer?: 'auto' | RendererBackend | RendererPreference
  antialias?: boolean
  alpha?: boolean
  pixelRatio?: number
  maxPixelRatio?: number
  autoResize?: boolean
  development?: boolean
  frameBudgetMs?: number
  maxPointLights?: number
  maxSpotLights?: number
  colorManagement?: Partial<RendererColorManagement>
  environmentLighting?: Partial<RendererEnvironmentLighting>
  shadows?: Partial<RendererShadowOptions>
  imageQuality?: Partial<RendererImageQuality>
  atmosphere?: Partial<RendererAtmosphere>
  colorGrading?: Partial<RendererColorGrading>
  postProcessing?: Partial<RendererPostProcessing>
  optimization?: Partial<RendererOptimizationOptions>
  plugins?: readonly EnginePlugin[]
  /** Explicit optional renderer modules. Importing a subpath never installs a module globally. */
  modules?: readonly RendererModule[]
}

export interface FrameInfo { deltaTime: number; elapsedTime: number; frame: number }
export interface EngineStats {
  framesPerSecond: number
  frameTime: number
  frame: number
  drawCalls: number
  triangles: number
  visibleObjects: number
  culledObjects: number
  geometryMemory: number
  textureMemory: number
  pipelineChanges: number
  resourceScopes: number
  trackedResources: number
}
export interface DiagnosticReport {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  details?: Readonly<Record<string, unknown>>
}
interface EngineEvents {
  diagnostic: DiagnosticReport
  resized: { width: number; height: number; pixelRatio: number }
  backendfallback: { preferred: RendererBackend; actual: RendererBackend; reason: string }
  disposed: undefined
}
export interface EngineSceneActionContext { objectId?: string; source?: Event }
export type RegisteredSceneAction = (value: unknown, context?: EngineSceneActionContext) => void | Promise<void>
export interface EnginePluginContext {
  registerObjectType(type: string, factory: SceneObjectFactory): () => void
  registerSceneAction(name: string, action: RegisteredSceneAction): () => void
  diagnostics: { report(value: DiagnosticReport): void }
}
export interface EnginePlugin { name: string; setup(context: EnginePluginContext): void | (() => void) }

export class Engine extends EventDispatcher<EngineEvents> {
  readonly resources = new ResourceManager()
  readonly renderer: Renderer
  readonly canvas: RenderSurface
  readonly capabilities: RendererCapabilities
  readonly modules: RendererModuleHost
  readonly development: boolean
  readonly diagnostics = { report: (value: DiagnosticReport): void => this.emit('diagnostic', value) }
  readonly stats: EngineStats = {
    framesPerSecond: 0,
    frameTime: 0,
    frame: 0,
    drawCalls: 0,
    triangles: 0,
    visibleObjects: 0,
    culledObjects: 0,
    geometryMemory: 0,
    textureMemory: 0,
    pipelineChanges: 0,
    resourceScopes: 0,
    trackedResources: 0,
  }
  disposed = false
  width = 1
  height = 1
  pixelRatio = 1
  private frameHandle?: number
  private running = false
  private startTime = 0
  private previousTime = 0
  private smoothedFrameTime = 16.67
  private resizeObserver?: ResizeObserver
  private readonly objectFactories = new Map<string, SceneObjectFactory>()
  private readonly sceneActions = new Map<string, RegisteredSceneAction>()
  private readonly pluginCleanups = new Map<string, () => void>()
  private frameBudgetMs: number
  private disposal?: Promise<void>

  constructor(renderer: Renderer, canvas: RenderSurface, options: Pick<EngineOptions, 'development' | 'frameBudgetMs'> = {}) {
    super()
    this.renderer = renderer
    this.canvas = canvas
    this.capabilities = renderer.capabilities
    this.development = options.development ?? false
    this.frameBudgetMs = Math.max(1, options.frameBudgetMs ?? 20)
    this.modules = new RendererModuleHost(renderer, diagnostic => this.diagnostics.report(diagnostic))
  }

  initialize(options: EngineOptions): void {
    const maximum = Math.max(0.25, options.maxPixelRatio ?? 2)
    this.pixelRatio = Math.min(maximum, Math.max(0.25, options.pixelRatio ?? defaultPixelRatio(maximum)))
    if (options.autoResize !== false && isHtmlCanvas(this.canvas) && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeToDisplaySize())
      this.resizeObserver.observe(this.canvas)
    }
    this.resizeToDisplaySize()
    if (this.development && this.pixelRatio > 2) this.diagnostics.report({
      severity: 'warning',
      code: 'HIGH_PIXEL_RATIO',
      message: 'A high pixel ratio can substantially increase GPU cost.',
      details: { pixelRatio: this.pixelRatio },
    })
  }

  async installModules(modules: readonly RendererModule[]): Promise<void> {
    this.assertAlive()
    await this.modules.installAll(modules)
  }

  resize(width: number, height: number, pixelRatio = this.pixelRatio): void {
    this.assertAlive()
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.pixelRatio = Math.max(0.25, pixelRatio)
    this.renderer.resize(this.width, this.height, this.pixelRatio)
    this.emit('resized', { width: this.width, height: this.height, pixelRatio: this.pixelRatio })
  }

  resizeToDisplaySize(): void {
    if (isHtmlCanvas(this.canvas)) this.resize(this.canvas.clientWidth || this.canvas.width || 1, this.canvas.clientHeight || this.canvas.height || 1, this.pixelRatio)
    else this.resize(this.canvas.width || 1, this.canvas.height || 1, this.pixelRatio)
  }

  setClearColor(color: ColorInput): this { this.renderer.setClearColor(color); return this }
  setColorManagement(options: Partial<RendererColorManagement>): this { this.renderer.setColorManagement(options); return this }
  setEnvironmentLighting(options: Partial<RendererEnvironmentLighting>): this { this.renderer.setEnvironmentLighting(options); return this }
  setShadowOptions(options: Partial<RendererShadowOptions>): this { this.renderer.setShadowOptions(options); return this }
  setImageQuality(options: Partial<RendererImageQuality>): this { this.renderer.setImageQuality(options); return this }
  setAtmosphere(options: Partial<RendererAtmosphere>): this { this.renderer.setAtmosphere(options); return this }
  setColorGrading(options: Partial<RendererColorGrading>): this { this.renderer.setColorGrading(options); return this }
  setPostProcessing(options: Partial<RendererPostProcessing>): this { this.renderer.setPostProcessing(options); return this }

  render(scene: Scene, camera: Camera): void {
    this.assertAlive()
    this.modules.beforeRender(scene, camera)
    this.renderer.render(scene, camera)
    this.modules.afterRender(scene, camera)
    const source = this.renderer.stats
    this.stats.drawCalls = source.drawCalls
    this.stats.triangles = source.triangles
    this.stats.visibleObjects = source.visibleObjects
    this.stats.culledObjects = source.culledObjects
    this.stats.geometryMemory = source.geometryMemory
    this.stats.textureMemory = source.textureMemory
    this.stats.pipelineChanges = source.pipelineChanges
    const resources = this.resources.stats
    this.stats.resourceScopes = resources.scopes
    this.stats.trackedResources = resources.trackedResources
  }

  start(callback: (frame: FrameInfo) => void): void {
    this.assertAlive()
    if (this.running) this.stop()
    this.running = true
    this.startTime = now()
    this.previousTime = this.startTime
    const tick = (time: number): void => {
      if (!this.running) return
      const deltaMilliseconds = Math.min(250, Math.max(0, time - this.previousTime))
      this.previousTime = time
      this.smoothedFrameTime = this.smoothedFrameTime * 0.9 + deltaMilliseconds * 0.1
      this.stats.frame += 1
      this.stats.frameTime = deltaMilliseconds
      this.stats.framesPerSecond = this.smoothedFrameTime > 0 ? 1000 / this.smoothedFrameTime : 0
      if (this.development && deltaMilliseconds > this.frameBudgetMs * 2 && this.stats.frame % 30 === 0) this.diagnostics.report({
        severity: 'warning',
        code: 'FRAME_BUDGET_EXCEEDED',
        message: 'The frame exceeded the configured frame budget.',
        details: { frameTime: deltaMilliseconds, budget: this.frameBudgetMs },
      })
      const frame = { deltaTime: deltaMilliseconds / 1000, elapsedTime: (time - this.startTime) / 1000, frame: this.stats.frame }
      this.modules.update(frame)
      callback(frame)
      this.frameHandle = requestFrame(tick)
    }
    this.frameHandle = requestFrame(tick)
  }

  startFixed(
    update: (fixedDelta: number, frame: FrameInfo) => void,
    render: (frame: FrameInfo) => void,
    fixedDelta = 1 / 60,
    maxSteps = 5,
  ): void {
    let accumulator = 0
    this.start(frame => {
      accumulator = Math.min(accumulator + frame.deltaTime, fixedDelta * maxSteps)
      let steps = 0
      while (accumulator >= fixedDelta && steps < maxSteps) {
        update(fixedDelta, frame)
        accumulator -= fixedDelta
        steps += 1
      }
      render(frame)
    })
  }

  stop(): void {
    this.running = false
    if (this.frameHandle !== undefined) cancelFrame(this.frameHandle)
    this.frameHandle = undefined
  }

  async loadScene(definition: SceneDefinition): Promise<LoadedScene> {
    this.assertAlive()
    const loaded = await loadSceneDefinition(definition, { objectFactories: this.objectFactories })
    const background = definition.scene.environment?.background
    if (background !== undefined) this.setClearColor(background)
    return loaded
  }

  use(plugin: EnginePlugin): () => void {
    this.assertAlive()
    if (this.pluginCleanups.has(plugin.name)) throw new Error(`Sekai64 plugin is already installed: ${plugin.name}`)
    const registrations: Array<() => void> = []
    const cleanup = plugin.setup({
      registerObjectType: (type, factory) => {
        if (this.objectFactories.has(type)) throw new Error(`Object type is already registered: ${type}`)
        this.objectFactories.set(type, factory)
        const remove = (): void => { if (this.objectFactories.get(type) === factory) this.objectFactories.delete(type) }
        registrations.push(remove)
        return remove
      },
      registerSceneAction: (name, action) => {
        if (this.sceneActions.has(name)) throw new Error(`Scene action is already registered: ${name}`)
        this.sceneActions.set(name, action)
        const remove = (): void => { if (this.sceneActions.get(name) === action) this.sceneActions.delete(name) }
        registrations.push(remove)
        return remove
      },
      diagnostics: this.diagnostics,
    })
    let installed = true
    const uninstall = (): void => {
      if (!installed) return
      installed = false
      cleanup?.()
      for (const remove of registrations.reverse()) remove()
      this.pluginCleanups.delete(plugin.name)
    }
    this.pluginCleanups.set(plugin.name, uninstall)
    return uninstall
  }

  async runSceneAction(name: string, value: unknown, context: EngineSceneActionContext = {}): Promise<void> {
    this.assertAlive()
    const action = this.sceneActions.get(name)
    if (!action) throw new Error(`Scene action is not registered: ${name}`)
    await action(value, context)
  }

  hasPlugin(name: string): boolean { return this.pluginCleanups.has(name) }

  async recoverModules(context: RendererRecoveryContext): Promise<void> {
    await this.modules.recover(context)
  }

  dispose(): void { void this.disposeAsync() }

  disposeAsync(): Promise<void> {
    if (this.disposal) return this.disposal
    this.disposal = this.disposeInternal()
    return this.disposal
  }

  private async disposeInternal(): Promise<void> {
    if (this.disposed) return
    this.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    if (this.development) {
      const stats = this.resources.stats
      if (stats.trackedResources > 0) this.diagnostics.report({
        severity: 'warning',
        code: 'RESOURCE_SCOPE_LEAK',
        message: 'Tracked resources remained when the engine was disposed.',
        details: stats,
      })
    }
    for (const cleanup of [...this.pluginCleanups.values()].reverse()) cleanup()
    this.pluginCleanups.clear()
    this.objectFactories.clear()
    this.sceneActions.clear()
    await this.modules.disposeAsync()
    this.resources.dispose()
    this.renderer.dispose()
    this.disposed = true
    this.emit('disposed', undefined)
    this.clearListeners()
  }

  private assertAlive(): void { if (this.disposed) throw new Error('Sekai64 Engine is disposed.') }
}

export async function createEngine(options: EngineOptions): Promise<Engine> {
  const canvas = resolveCanvas(options.canvas)
  let engineRef: Engine | undefined
  const result = await createRenderer(options, canvas, diagnostic => engineRef?.diagnostics.report(diagnostic))
  const engine = new Engine(result.renderer, canvas, options)
  engineRef = engine
  engine.initialize(options)
  try {
    await engine.installModules(options.modules ?? [])
    for (const plugin of options.plugins ?? []) engine.use(plugin)
  } catch (error) {
    await engine.disposeAsync()
    throw error
  }
  if (result.fallback) queueMicrotask(() => {
    engine.emit('backendfallback', result.fallback as { preferred: RendererBackend; actual: RendererBackend; reason: string })
    engine.diagnostics.report({
      severity: 'warning',
      code: 'RENDERER_FALLBACK',
      message: `Sekai64 fell back from ${result.fallback?.preferred} to ${result.fallback?.actual}.`,
      details: { reason: result.fallback?.reason },
    })
  })
  return engine
}

async function createRenderer(
  options: EngineOptions,
  canvas: RenderSurface,
  diagnostics: (report: DiagnosticReport) => void,
): Promise<{ renderer: Renderer; fallback?: { preferred: RendererBackend; actual: RendererBackend; reason: string } }> {
  const preference = normalizePreference(options.renderer)
  const preferred = preference.preferredBackend
  const fallback = preference.fallback
  const initialize = async (backend: RendererBackend): Promise<Renderer> => {
    const renderer: Renderer = backend === 'webgpu'
      ? new (await import('@sekai64-internal/renderer-webgpu')).WebGPURenderer()
      : new (await import('@sekai64-internal/renderer-webgl2')).WebGL2Renderer()
    await renderer.initialize({
      canvas,
      antialias: options.antialias,
      alpha: options.alpha,
      powerPreference: preference.powerPreference,
      maxPointLights: options.maxPointLights,
      maxSpotLights: options.maxSpotLights,
      colorManagement: options.colorManagement,
      environmentLighting: options.environmentLighting,
      shadows: options.shadows,
      imageQuality: options.imageQuality,
      atmosphere: options.atmosphere,
      colorGrading: options.colorGrading,
      postProcessing: options.postProcessing,
      optimization: options.optimization,
      diagnostics,
    })
    return renderer
  }
  try {
    if (preferred === 'webgpu' && !isWebGPUSupported()) throw new Error('WebGPU capability detection failed.')
    return { renderer: await initialize(preferred) }
  } catch (error) {
    if (!fallback || fallback === preferred) throw error
    return {
      renderer: await initialize(fallback),
      fallback: { preferred, actual: fallback, reason: error instanceof Error ? error.message : String(error) },
    }
  }
}

function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu)
}
function normalizePreference(renderer: EngineOptions['renderer']): Required<RendererPreference> {
  if (!renderer || renderer === 'auto') return { preferredBackend: 'webgpu', fallback: 'webgl2', powerPreference: 'high-performance' }
  if (renderer === 'webgpu') return { preferredBackend: 'webgpu', fallback: false, powerPreference: 'high-performance' }
  if (renderer === 'webgl2') return { preferredBackend: 'webgl2', fallback: false, powerPreference: 'high-performance' }
  return {
    preferredBackend: renderer.preferredBackend ?? 'webgpu',
    fallback: renderer.fallback ?? 'webgl2',
    powerPreference: renderer.powerPreference ?? 'high-performance',
  }
}
function resolveCanvas(value: RenderSurface | string): RenderSurface {
  if (typeof value !== 'string') return value
  if (typeof document === 'undefined') throw new Error('A canvas selector cannot be resolved outside a browser document.')
  const canvas = document.querySelector(value)
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`Canvas not found for selector: ${value}`)
  return canvas
}
function defaultPixelRatio(maximum: number): number { return typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, maximum) : 1 }
function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }
function requestFrame(callback: FrameRequestCallback): number { return typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(() => callback(now()), 16) as unknown as number }
function cancelFrame(handle: number): void { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle); else clearTimeout(handle) }
function isHtmlCanvas(canvas: RenderSurface): canvas is HTMLCanvasElement { return typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement }
