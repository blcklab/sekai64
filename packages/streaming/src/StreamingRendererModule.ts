import type { RendererModule, RendererModuleInstance } from '@sekai64-internal/modules'
import { AssetTaskScheduler } from './AssetTaskScheduler.js'
import { SEKAI64_MODULE_VERSION } from '@sekai64-internal/modules'

export interface StreamingRendererModuleOptions { concurrency?: number }
export class StreamingRendererModule implements RendererModule {
  readonly id = 'sekai64.streaming'
  readonly version = SEKAI64_MODULE_VERSION
  readonly scheduler: AssetTaskScheduler
  constructor(options: StreamingRendererModuleOptions = {}) { this.scheduler = new AssetTaskScheduler(options.concurrency ?? 4) }
  setup(): RendererModuleInstance { return { capabilities: { backgroundLoading: true, cancellation: true, requestDeduplication: true, referenceCounting: true, workerCompatible: true }, dispose: () => this.scheduler.dispose() } }
}
export function createStreamingRendererModule(options: StreamingRendererModuleOptions = {}): StreamingRendererModule { return new StreamingRendererModule(options) }
