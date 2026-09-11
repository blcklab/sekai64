import type { DecodeRequest, DecodedAsset, Sekai64AssetDecoderAdapter } from '@blcklab/sekai64/decoders'

export interface MeshoptDecoderBridge<T = unknown> {
  decode(data: ArrayBuffer, options: Readonly<Record<string, unknown>>, context: { signal?: AbortSignal; report(progress: number, stage?: string): void }): T | Promise<T>
  dispose?(): void | Promise<void>
}
export interface MeshoptAdapterOptions { id?: string; kind?: string }
export function createMeshoptAdapter<T = unknown>(decoder: MeshoptDecoderBridge<T>, options: MeshoptAdapterOptions = {}): Sekai64AssetDecoderAdapter<T> {
  return {
    id: options.id ?? 'sekai64.meshopt',
    formats: ['meshopt', 'ext_meshopt_compression'],
    async decode(request: DecodeRequest): Promise<DecodedAsset<T>> {
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 0, ratio: 0, stage: 'meshopt-decode' })
      const value = await decoder.decode(request.data, request.options ?? {}, { signal: request.signal, report: (ratio, stage) => request.onProgress?.({ loaded: ratio, total: 1, ratio, ...(stage ? { stage } : {}) }) })
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 1, total: 1, ratio: 1, stage: 'complete' })
      return { kind: options.kind ?? 'geometry-buffer', value, metadata: { codec: 'meshopt' } }
    },
    dispose: () => decoder.dispose?.(),
  }
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
