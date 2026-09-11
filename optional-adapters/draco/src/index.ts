import type { DecodeRequest, DecodedAsset, Sekai64AssetDecoderAdapter } from '@blcklab/sekai64/decoders'

export interface DracoDecoderBridge<T = unknown> {
  decode(data: ArrayBuffer, options: Readonly<Record<string, unknown>>, context: { signal?: AbortSignal; report(progress: number, stage?: string): void }): T | Promise<T>
  dispose?(): void | Promise<void>
}
export interface DracoAdapterOptions { id?: string; kind?: string }
export function createDracoAdapter<T = unknown>(decoder: DracoDecoderBridge<T>, options: DracoAdapterOptions = {}): Sekai64AssetDecoderAdapter<T> {
  return {
    id: options.id ?? 'sekai64.draco',
    formats: ['draco', 'khr_draco_mesh_compression'],
    async decode(request: DecodeRequest): Promise<DecodedAsset<T>> {
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 0, ratio: 0, stage: 'draco-decode' })
      const value = await decoder.decode(request.data, request.options ?? {}, { signal: request.signal, report: (ratio, stage) => request.onProgress?.({ loaded: ratio, total: 1, ratio, ...(stage ? { stage } : {}) }) })
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 1, total: 1, ratio: 1, stage: 'complete' })
      return { kind: options.kind ?? 'geometry', value, metadata: { codec: 'draco' } }
    },
    dispose: () => decoder.dispose?.(),
  }
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
