import type { DecodeRequest, DecodedAsset, Sekai64AssetDecoderAdapter } from '@blcklab/sekai64/decoders'

export interface Ktx2TranscoderBridge<T = unknown> {
  transcode(data: ArrayBuffer, options: Readonly<Record<string, unknown>>, context: { signal?: AbortSignal; report(progress: number, stage?: string): void }): T | Promise<T>
  dispose?(): void | Promise<void>
}
export interface Ktx2AdapterOptions { id?: string; kind?: string }
export function createKtx2Adapter<T = unknown>(transcoder: Ktx2TranscoderBridge<T>, options: Ktx2AdapterOptions = {}): Sekai64AssetDecoderAdapter<T> {
  return {
    id: options.id ?? 'sekai64.ktx2',
    formats: ['ktx2', 'basis', 'basisu', 'khr_texture_basisu'],
    async decode(request: DecodeRequest): Promise<DecodedAsset<T>> {
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 0, ratio: 0, stage: 'ktx2-transcode' })
      const value = await transcoder.transcode(request.data, request.options ?? {}, { signal: request.signal, report: (ratio, stage) => request.onProgress?.({ loaded: ratio, total: 1, ratio, ...(stage ? { stage } : {}) }) })
      throwIfAborted(request.signal); request.onProgress?.({ loaded: 1, total: 1, ratio: 1, stage: 'complete' })
      return { kind: options.kind ?? 'compressed-texture', value, metadata: { codec: 'ktx2-basis' } }
    },
    dispose: () => transcoder.dispose?.(),
  }
}
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
