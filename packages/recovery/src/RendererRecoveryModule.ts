import { EventDispatcher } from '@sekai64-internal/core'
import type { RendererModule, RendererModuleContext, RendererModuleInstance } from '@sekai64-internal/modules'
import type { RecoverableRenderer } from '@sekai64-internal/renderer'
import { SEKAI64_MODULE_VERSION } from '@sekai64-internal/modules'

export interface RecoveryResource { id: string; restore(): void | Promise<void> }
export interface RendererRecoveryOptions { maxAttempts?: number }
interface RecoveryEvents { progress: { attempt: number; progress: number; message?: string }; recovered: { attempt: number }; failed: { attempt: number; error: unknown } }

export class RendererRecoveryModule extends EventDispatcher<RecoveryEvents> implements RendererModule {
  readonly id = 'sekai64.recovery'; readonly version = SEKAI64_MODULE_VERSION
  readonly resources = new Map<string, RecoveryResource>()
  private context?: RendererModuleContext
  private recovering?: Promise<void>
  constructor(readonly options: RendererRecoveryOptions = {}) { super() }
  setup(context: RendererModuleContext): RendererModuleInstance { this.context = context; return { capabilities: { automaticDeviceRecreation: typeof (context.renderer as RecoverableRenderer).recover === 'function', resourceRestoration: true, terminalFailure: true }, recover: recovery => this.recover(recovery.reason), dispose: () => this.dispose() } }
  register(resource: RecoveryResource): () => void { if (this.resources.has(resource.id)) throw new Error(`Recovery resource is already registered: ${resource.id}`); this.resources.set(resource.id, resource); return () => { if (this.resources.get(resource.id) === resource) this.resources.delete(resource.id) } }
  recover(reason?: unknown): Promise<void> { if (this.recovering) return this.recovering; this.recovering = this.runRecovery(reason).finally(() => { this.recovering = undefined }); return this.recovering }
  private async runRecovery(reason?: unknown): Promise<void> {
    const renderer = this.context?.renderer as RecoverableRenderer | undefined
    if (!renderer?.recover) throw new Error('The active renderer does not expose automatic recovery. Use Player world replacement as the fallback.')
    const maximum = Math.max(1, Math.floor(this.options.maxAttempts ?? 2)); let lastError: unknown
    for (let attempt = 1; attempt <= maximum; attempt += 1) {
      try {
        this.emit('progress', { attempt, progress: 0, message: 'Recreating renderer backend' })
        await renderer.recover({ reason, onProgress: (progress: number, message?: string) => this.emit('progress', { attempt, progress, ...(message ? { message } : {}) }) })
        let index = 0
        for (const resource of this.resources.values()) { await resource.restore(); index += 1; this.emit('progress', { attempt, progress: this.resources.size === 0 ? 1 : index / this.resources.size, message: `Restored ${resource.id}` }) }
        this.emit('recovered', { attempt }); return
      } catch (error) { lastError = error; this.emit('failed', { attempt, error }) }
    }
    throw new Error(`Sekai64 renderer recovery failed after ${maximum} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }
  dispose(): void { this.resources.clear(); this.context = undefined; this.clearListeners() }
}
export function createRendererRecoveryModule(options: RendererRecoveryOptions = {}): RendererRecoveryModule { return new RendererRecoveryModule(options) }
