import type { GltfDracoDecodeRequest, GltfDracoDecodedPrimitive, GltfDracoDecoder } from './GltfLoader.js'

/**
 * Google Draco's versioned browser decoder. No codec bytes are bundled into
 * Sekai64: the wrapper/WASM are requested lazily only when a Draco-compressed
 * primitive is actually decoded.
 */
export const DEFAULT_DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'

export interface BrowserDracoDecoderOptions {
  /**
   * Folder containing `draco_wasm_wrapper_gltf.js` and
   * `draco_decoder_gltf.wasm`. May be an absolute URL or local public path.
   */
  decoderPath?: string
}

interface DracoStatus { ok(): boolean; error_msg(): string }
interface DracoAttribute { ptr?: number; num_components(): number }
interface DracoFloat32Array { size(): number; GetValue(index: number): number }
interface DracoInt32Array { size(): number; GetValue(index: number): number }
interface DracoDecoderBuffer { Init(data: Int8Array, length: number): void }
interface DracoMesh { num_points(): number; num_faces(): number }
interface DracoDecoder {
  GetEncodedGeometryType(buffer: DracoDecoderBuffer): number
  DecodeBufferToMesh(buffer: DracoDecoderBuffer, mesh: DracoMesh): DracoStatus
  GetAttributeByUniqueId(mesh: DracoMesh, uniqueId: number): DracoAttribute
  GetAttributeFloatForAllPoints(mesh: DracoMesh, attribute: DracoAttribute, output: DracoFloat32Array): void
  GetFaceFromMesh(mesh: DracoMesh, faceIndex: number, output: DracoInt32Array): void
}
interface DracoModule {
  TRIANGULAR_MESH: number
  DecoderBuffer: new () => DracoDecoderBuffer
  Decoder: new () => DracoDecoder
  Mesh: new () => DracoMesh
  DracoFloat32Array: new () => DracoFloat32Array
  DracoInt32Array: new () => DracoInt32Array
  destroy(value: unknown): void
}
type DracoModuleFactory = (config?: Readonly<Record<string, unknown>>) => DracoModule | Promise<DracoModule>

const modulePromises = new Map<string, Promise<DracoModule>>()
const scriptPromises = new Map<string, Promise<void>>()

export function createBrowserDracoDecoder(options: BrowserDracoDecoderOptions = {}): GltfDracoDecoder {
  const decoderPath = normalizeDecoderPath(options.decoderPath ?? DEFAULT_DRACO_DECODER_PATH)
  return {
    async decode(request: GltfDracoDecodeRequest): Promise<GltfDracoDecodedPrimitive> {
      throwIfAborted(request.signal)
      const module = await getDracoModule(decoderPath, request.signal)
      throwIfAborted(request.signal)
      return decodePrimitive(module, request)
    },
  }
}

async function getDracoModule(decoderPath: string, signal?: AbortSignal): Promise<DracoModule> {
  let promise = modulePromises.get(decoderPath)
  if (!promise) {
    promise = initializeDracoModule(decoderPath)
    modulePromises.set(decoderPath, promise)
    void promise.catch(() => { if (modulePromises.get(decoderPath) === promise) modulePromises.delete(decoderPath) })
  }
  return signal ? awaitWithAbort(promise, signal) : promise
}

async function initializeDracoModule(decoderPath: string): Promise<DracoModule> {
  if (typeof document === 'undefined') throw new Error('Automatic Draco decoding requires a browser document. Provide a custom GltfDracoDecoder in non-browser runtimes.')
  if (typeof WebAssembly !== 'object') throw new Error('This browser does not support WebAssembly required for Draco-compressed glTF assets.')
  const wrapperUrl = `${decoderPath}draco_wasm_wrapper_gltf.js`
  const wasmUrl = `${decoderPath}draco_decoder_gltf.wasm`
  try {
    await loadScript(wrapperUrl)
    const factory = getGlobalFactory()
    if (!factory) throw new Error('The Draco decoder wrapper loaded but did not expose DracoDecoderModule.')
    const response = await fetch(wasmUrl, { credentials: 'omit', mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${wasmUrl}`)
    const wasmBinary = await response.arrayBuffer()
    const module = await Promise.resolve(factory({ wasmBinary }))
    if (!module?.Decoder || !module?.DecoderBuffer || !module?.Mesh) throw new Error('The Draco decoder module initialized without the required mesh decoder API.')
    return module
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to initialize the Draco decoder from ${decoderPath}. ${message} Self-host the decoder files and set dracoDecoderPath if your app blocks external scripts.`, { cause: error })
  }
}

function decodePrimitive(module: DracoModule, request: GltfDracoDecodeRequest): GltfDracoDecodedPrimitive {
  const buffer = new module.DecoderBuffer()
  const decoder = new module.Decoder()
  const mesh = new module.Mesh()
  try {
    throwIfAborted(request.signal)
    const encoded = new Int8Array(request.data)
    buffer.Init(encoded, encoded.byteLength)
    if (decoder.GetEncodedGeometryType(buffer) !== module.TRIANGULAR_MESH) throw new Error('KHR_draco_mesh_compression payload is not a triangular Draco mesh.')
    const status = decoder.DecodeBufferToMesh(buffer, mesh)
    try { if (!status.ok()) throw new Error(`Draco mesh decode failed: ${status.error_msg() || 'unknown decoder error'}`) }
    finally { safeDestroy(module, status) }
    const attributes: Record<string, Float32Array> = {}
    const pointCount = mesh.num_points()
    for (const [semantic, uniqueId] of Object.entries(request.attributes)) {
      throwIfAborted(request.signal)
      const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId)
      if (!attribute || attribute.ptr === 0) throw new Error(`Draco attribute ${semantic} with unique id ${uniqueId} was not found.`)
      const components = attribute.num_components()
      if (!Number.isInteger(components) || components <= 0) throw new Error(`Draco attribute ${semantic} reported an invalid component count.`)
      const decoded = new module.DracoFloat32Array()
      try {
        decoder.GetAttributeFloatForAllPoints(mesh, attribute, decoded)
        const values = new Float32Array(pointCount * components)
        if (decoded.size() < values.length) throw new Error(`Draco attribute ${semantic} returned ${decoded.size()} values; expected ${values.length}.`)
        for (let index = 0; index < values.length; index += 1) values[index] = decoded.GetValue(index)
        attributes[semantic] = values
      } finally { module.destroy(decoded) }
    }
    const faceCount = mesh.num_faces()
    const indices = new Uint32Array(faceCount * 3)
    const face = new module.DracoInt32Array()
    try {
      for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
        throwIfAborted(request.signal)
        decoder.GetFaceFromMesh(mesh, faceIndex, face)
        if (face.size() < 3) throw new Error(`Draco face ${faceIndex} did not contain three indices.`)
        const offset = faceIndex * 3
        indices[offset] = face.GetValue(0)
        indices[offset + 1] = face.GetValue(1)
        indices[offset + 2] = face.GetValue(2)
      }
    } finally { module.destroy(face) }
    return { attributes, indices }
  } finally {
    module.destroy(mesh)
    module.destroy(decoder)
    module.destroy(buffer)
  }
}

function safeDestroy(module: DracoModule, value: unknown): void { try { module.destroy(value) } catch { /* cleanup compatibility */ } }
function loadScript(source: string): Promise<void> {
  const existing = scriptPromises.get(source)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    if (getGlobalFactory()) { resolve(); return }
    const script = document.createElement('script')
    script.src = source
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.sekai64Draco = source
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load Draco decoder wrapper: ${source}`))
    document.head.appendChild(script)
  })
  scriptPromises.set(source, promise)
  void promise.catch(() => { if (scriptPromises.get(source) === promise) scriptPromises.delete(source) })
  return promise
}
function getGlobalFactory(): DracoModuleFactory | undefined { return (globalThis as typeof globalThis & { DracoDecoderModule?: DracoModuleFactory }).DracoDecoderModule }
function normalizeDecoderPath(value: string): string { const trimmed = value.trim(); if (!trimmed) throw new Error('dracoDecoderPath cannot be empty.'); return trimmed.endsWith('/') ? trimmed : `${trimmed}/` }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError') }
function awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(value => { signal.removeEventListener('abort', onAbort); resolve(value) }, error => { signal.removeEventListener('abort', onAbort); reject(error) })
  })
}
