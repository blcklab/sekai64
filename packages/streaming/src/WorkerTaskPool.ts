export interface WorkerTaskExecutor<Input, Output> { (input: Input, context: { signal: AbortSignal }): Promise<Output> }

export class WorkerTaskPool<Input, Output> {
  private readonly controllers = new Set<AbortController>()
  private disposed = false
  constructor(readonly executeTask: WorkerTaskExecutor<Input, Output>) {}
  async run(input: Input, signal?: AbortSignal): Promise<Output> {
    if (this.disposed) throw new Error('WorkerTaskPool is disposed.')
    const controller = new AbortController()
    this.controllers.add(controller)
    const stop = forwardAbort(signal, controller)
    try { return await this.executeTask(input, { signal: controller.signal }) }
    finally { stop(); this.controllers.delete(controller) }
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const controller of this.controllers) controller.abort(new Error('WorkerTaskPool disposed.')); this.controllers.clear() }
}
function forwardAbort(source: AbortSignal | undefined, target: AbortController): () => void { if (!source) return () => undefined; if (source.aborted) { target.abort(source.reason); return () => undefined }; const listener = (): void => target.abort(source.reason); source.addEventListener('abort', listener, { once: true }); return () => source.removeEventListener('abort', listener) }
