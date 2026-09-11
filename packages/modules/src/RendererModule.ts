import type { Camera } from '@sekai64-internal/cameras'
import type { Renderer, RendererBackend, RendererDiagnostic } from '@sekai64-internal/renderer'
import type { Scene } from '@sekai64-internal/scene'

export type RendererModuleCapabilityValue = boolean | number | string | readonly string[]
export type RendererModuleCapabilities = Readonly<Record<string, RendererModuleCapabilityValue>>

export interface RendererModuleFrame {
  deltaTime: number
  elapsedTime: number
  frame: number
}

export interface RendererRecoveryContext {
  backend: RendererBackend
  attempt: number
  reason?: unknown
  report(progress: number, message?: string): void
}

export interface RendererModuleContext {
  readonly renderer: Renderer
  readonly diagnostics: { report(diagnostic: RendererDiagnostic): void }
  registerCleanup(cleanup: () => void | Promise<void>): () => void
}

export interface RendererModuleInstance {
  readonly capabilities?: RendererModuleCapabilities
  update?(frame: RendererModuleFrame): void
  beforeRender?(scene: Scene, camera: Camera): void
  afterRender?(scene: Scene, camera: Camera): void
  recover?(context: RendererRecoveryContext): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface RendererModule {
  readonly id: string
  readonly version?: string
  readonly requires?: readonly string[]
  readonly optional?: readonly string[]
  setup(context: RendererModuleContext): RendererModuleInstance | void | Promise<RendererModuleInstance | void>
}

export interface InstalledRendererModule {
  readonly id: string
  readonly version?: string
  readonly capabilities: RendererModuleCapabilities
}
