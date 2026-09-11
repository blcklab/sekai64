import { AssetManager, type AssetLease, type AssetLoadOptions } from '@sekai64-internal/assets'
import { Geometry, type GeometryData } from '@sekai64-internal/geometry'
import {
  StandardMaterial,
  Texture,
  type TextureColorSpace,
  type TextureLoadOptions,
  type TextureMagFilter,
  type TextureMinFilter,
  type TextureSource,
  type TextureWrap
} from '@sekai64-internal/materials'
import { Euler } from '@sekai64-internal/math'
import { batchStaticMeshes, Mesh, Node, Scene } from '@sekai64-internal/scene'
import { createBrowserDracoDecoder, type BrowserDracoDecoderOptions } from './BrowserDracoDecoder.js'

export interface GltfBuffer { uri?: string; byteLength: number }
export interface GltfBufferView { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }
export interface GltfAccessorSparseIndices { bufferView: number; byteOffset?: number; componentType: 5121 | 5123 | 5125 | number }
export interface GltfAccessorSparseValues { bufferView: number; byteOffset?: number }
export interface GltfAccessorSparse { count: number; indices: GltfAccessorSparseIndices; values: GltfAccessorSparseValues }
export interface GltfAccessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean; sparse?: GltfAccessorSparse }
export interface GltfTextureInfo { index: number; texCoord?: number; extensions?: Record<string, unknown> }
export interface GltfNormalTextureInfo extends GltfTextureInfo { scale?: number }
export interface GltfOcclusionTextureInfo extends GltfTextureInfo { strength?: number }
export interface GltfPbrMetallicRoughness {
  baseColorFactor?: number[]
  baseColorTexture?: GltfTextureInfo
  metallicFactor?: number
  roughnessFactor?: number
  metallicRoughnessTexture?: GltfTextureInfo
}
export interface GltfPrimitive { attributes: Record<string, number>; indices?: number; material?: number; mode?: number; targets?: Array<Record<string, number>>; extensions?: Record<string, unknown> }
export interface GltfMesh { name?: string; primitives: GltfPrimitive[]; weights?: number[] }
export interface GltfNode { name?: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[]; weights?: number[] }
export interface GltfMaterial {
  name?: string
  pbrMetallicRoughness?: GltfPbrMetallicRoughness
  normalTexture?: GltfNormalTextureInfo
  occlusionTexture?: GltfOcclusionTextureInfo
  emissiveTexture?: GltfTextureInfo
  emissiveFactor?: number[]
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND' | string
  alphaCutoff?: number
  doubleSided?: boolean
  extensions?: Record<string, unknown>
  extras?: Record<string, unknown>
}
export interface GltfImage { name?: string; uri?: string; mimeType?: string; bufferView?: number }
export interface GltfTexture { name?: string; sampler?: number; source?: number; extensions?: Record<string, unknown> }
export interface GltfSampler { magFilter?: number; minFilter?: number; wrapS?: number; wrapT?: number }
export interface GltfSkin { name?: string; inverseBindMatrices?: number; skeleton?: number; joints: number[] }
export interface GltfAnimationSampler { input: number; output: number; interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE' | string }
export interface GltfAnimationChannel { sampler: number; target: { node?: number; path: 'translation' | 'rotation' | 'scale' | 'weights' | string } }
export interface GltfAnimation { name?: string; samplers: GltfAnimationSampler[]; channels: GltfAnimationChannel[] }
export interface GltfScene { name?: string; nodes?: number[] }
export interface GltfDocument {
  asset: { version: string }
  buffers?: GltfBuffer[]
  bufferViews?: GltfBufferView[]
  accessors?: GltfAccessor[]
  meshes?: GltfMesh[]
  nodes?: GltfNode[]
  materials?: GltfMaterial[]
  images?: GltfImage[]
  textures?: GltfTexture[]
  samplers?: GltfSampler[]
  scenes?: GltfScene[]
  skins?: GltfSkin[]
  animations?: GltfAnimation[]
  scene?: number
  /** Top-level glTF extensions, including VRMC_vrm and legacy VRM 0.x metadata. */
  extensions?: Record<string, unknown>
}


export interface GltfPrimitiveAnimationData {
  id: string
  nodeIndex: number
  meshIndex: number
  primitiveIndex: number
  skinIndex?: number
  base: GeometryData
  jointIndices?: Float32Array
  jointWeights?: Float32Array
  morphTargets: readonly { name: string; positions?: Float32Array; normals?: Float32Array }[]
  defaultWeights: readonly number[]
}
export interface GltfAnimationFinalizeContext {
  document: Readonly<GltfDocument>
  scene: Scene
  nodes: ReadonlyMap<number, readonly Node[]>
  readAccessor(index: number): Float32Array
}
export interface GltfRuntimeExtension<T = unknown> { id: string; value: T; dispose?(): void }

export interface GltfDracoDecodeRequest {
  data: ArrayBuffer
  /** glTF semantic to Draco unique attribute id from KHR_draco_mesh_compression. */
  attributes: Readonly<Record<string, number>>
  signal?: AbortSignal
}
export interface GltfDracoDecodedPrimitive {
  attributes: Readonly<Record<string, Float32Array>>
  indices?: Uint32Array
}
export interface GltfDracoDecoder {
  decode(request: GltfDracoDecodeRequest): Promise<GltfDracoDecodedPrimitive>
  dispose?(): void | Promise<void>
}
export interface GltfAnimationAdapter {
  readonly id: string
  createGeometry(data: GltfPrimitiveAnimationData): Geometry
  bindMesh?(mesh: Mesh, data: GltfPrimitiveAnimationData): void
  finalize?(context: GltfAnimationFinalizeContext): GltfRuntimeExtension | void | Promise<GltfRuntimeExtension | void>
}

export const GLTF_LOADER_CAPABILITIES = Object.freeze({
  formats: Object.freeze(['gltf', 'glb', 'vrm'] as const),
  imageSources: Object.freeze(['glb-buffer-view', 'external-uri', 'data-uri'] as const),
  imageMimeTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp'] as const),
  materialTextures: Object.freeze(['baseColor', 'normal', 'metallicRoughness', 'emissive', 'occlusion', 'lightMap', 'faceShadow', 'mtoonShade', 'mtoonShadingShift', 'mtoonMatcap', 'mtoonRim'] as const),
  geometryExtensions: Object.freeze(['KHR_draco_mesh_compression'] as const),
  textureExtensions: Object.freeze(['EXT_texture_webp'] as const),
  materialExtensions: Object.freeze(['KHR_materials_clearcoat', 'KHR_materials_sheen', 'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_emissive_strength', 'VRMC_materials_mtoon', 'SEKAI64_face_shadow', 'SEKAI64_lightmap', 'SEKAI64_water'] as const),
  textureCoordinateSets: Object.freeze([0, 1] as const),
  vertexColors: true,
  alphaMask: true,
  alphaBlend: true,
  doubleSided: true,
  samplers: true,
  optionalAnimationAdapter: true,
  sparseAccessors: true,
  browserDracoAutoDecode: true,
  legacyVrmMtoon: true
})

export type GltfDiagnosticCode =
  | 'SEKAI_GLTF_IMAGE_NOT_FOUND'
  | 'SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID'
  | 'SEKAI_GLTF_IMAGE_MIME_UNSUPPORTED'
  | 'SEKAI_GLTF_TEXTURE_INDEX_INVALID'
  | 'SEKAI_GLTF_TEXTURE_SOURCE_INVALID'
  | 'SEKAI_GLTF_SAMPLER_INVALID'
  | 'SEKAI_GLTF_UV_SET_MISSING'
  | 'SEKAI_GLTF_NORMAL_TANGENT_MISSING'
  | 'SEKAI_GLTF_TEXTURE_DECODE_FAILED'

export interface GltfDiagnostic {
  severity: 'warning' | 'error'
  code: GltfDiagnosticCode
  message: string
  source?: string
  materialIndex?: number
  materialName?: string
  textureIndex?: number
  imageIndex?: number
  primitiveId?: string
}

export interface GltfLoadOptions extends AssetLoadOptions {
  scene?: number
  strict?: boolean
  onDiagnostic?: (diagnostic: GltfDiagnostic) => void
  texture?: Omit<TextureLoadOptions, 'signal' | 'fetch'>
  animation?: GltfAnimationAdapter
  animatedFallback?: 'error' | 'static-pose'
  /**
   * Draco decoder policy for KHR_draco_mesh_compression.
   * - `undefined` / `'auto'`: lazily load the browser decoder only if the asset actually uses Draco.
   * - `false`: disable automatic Draco decoding and fail on compressed primitives.
   * - decoder object: use a caller-provided decoder.
   */
  draco?: GltfDracoDecoder | 'auto' | false
  /** Browser decoder source used by automatic Draco decoding. Self-host this folder for offline/CSP-restricted apps. */
  dracoDecoderPath?: string
  /** Automatically instance repeated static sibling meshes. Disabled when an animation adapter is active. */
  staticBatching?: boolean | { minInstances?: number }
  /** Internal namespace for generated glTF node IDs. loadNode() supplies a unique value automatically. */
  nodeIdPrefix?: string
}

interface GltfLoadContext {
  document: GltfDocument
  buffers: readonly ArrayBuffer[]
  sourceUrl: URL
  options: GltfLoadOptions
  assets: AssetManager
  leases: AssetLease<unknown>[]
  imageSources: Map<number, Promise<TextureSource>>
  textureCache: Map<string, Promise<Texture>>
  pendingTextures: Set<Promise<Texture>>
  ownedTextures: Set<Texture>
  nodes: Map<number, Node[]>
  nodeIdPrefix: string
}

export class GltfAsset {
  disposed = false
  private readonly cleanups: Array<() => void> = []
  private readonly extensions = new Map<string, GltfRuntimeExtension>()
  constructor(
    readonly scene: Scene,
    readonly document: Readonly<GltfDocument>,
    private readonly leases: readonly AssetLease<unknown>[],
    private readonly textures: readonly Texture[] = [],
    extensions: readonly GltfRuntimeExtension[] = []
  ) { for (const extension of extensions) { if (this.extensions.has(extension.id)) throw new Error(`Duplicate glTF runtime extension: ${extension.id}`); this.extensions.set(extension.id, extension) } }
  getExtension<T = unknown>(id: string): T | undefined { return this.extensions.get(id)?.value as T | undefined }
  onDispose(cleanup: () => void): this { if (this.disposed) cleanup(); else this.cleanups.push(cleanup); return this }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.scene.dispose()
    for (const extension of [...this.extensions.values()].reverse()) extension.dispose?.()
    this.extensions.clear()
    for (const texture of this.textures) texture.dispose()
    for (const lease of this.leases) lease.dispose()
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup()
  }
}

let nextGltfModelNumber = 1

function normalizedNodePrefix(value: string): string {
  const compact = value.replace(/[^a-zA-Z0-9:_-]+/g, '-').replace(/^-+|-+$/g, '')
  return compact || 'gltf-model'
}

function gltfNodeId(context: GltfLoadContext, suffix: string): string {
  return `${context.nodeIdPrefix}:${suffix}`
}

export class GltfModelNode extends Scene {
  constructor(readonly asset: GltfAsset, options: { id?: string; name?: string } = {}) {
    super({ id: options.id ?? `gltf-model-${nextGltfModelNumber++}`, name: options.name ?? asset.scene.name, tags: ['gltf-model'], autoDisposeResources: true })
    for (const child of [...asset.scene.children]) this.add(child)
  }
  override dispose(): void { if (this.disposed) return; super.dispose(); this.asset.dispose() }
}

export class GltfLoader {
  readonly assets: AssetManager
  readonly ownsAssets: boolean
  constructor(assets?: AssetManager) { this.assets = assets ?? new AssetManager(); this.ownsAssets = !assets }

  async load(source: string | URL, options: GltfLoadOptions = {}): Promise<GltfAsset> {
    const sourceUrl = new URL(source, typeof location !== 'undefined' ? location.href : 'file:///')
    const controller = new AbortController()
    const stopForwardingAbort = forwardAbort(options.signal, controller)
    const controlledOptions: GltfLoadOptions = { ...options, signal: controller.signal }
    const leases: AssetLease<unknown>[] = []
    const ownedTextures = new Set<Texture>()
    let context: GltfLoadContext | undefined
    let scene: Scene | undefined
    try {
      let document: GltfDocument
      let binaryChunk: ArrayBuffer | undefined
      if (isBinaryGltfPath(sourceUrl.pathname)) {
        const lease = await this.assets.loadArrayBuffer(sourceUrl, controlledOptions)
        leases.push(lease)
        const parsed = parseGlb(lease.value)
        document = parsed.document
        binaryChunk = parsed.binary
      } else {
        const lease = await this.assets.loadJson<GltfDocument>(sourceUrl, controlledOptions)
        leases.push(lease)
        document = lease.value
      }
      validateDocument(document)
      const buffers = await loadBuffers(document, binaryChunk, sourceUrl, this.assets, leases, controlledOptions)
      context = {
        document,
        buffers,
        sourceUrl,
        options: controlledOptions,
        assets: this.assets,
        leases,
        imageSources: new Map(),
        textureCache: new Map(),
        pendingTextures: new Set(),
        ownedTextures,
        nodes: new Map(),
        nodeIdPrefix: normalizedNodePrefix(controlledOptions.nodeIdPrefix ?? `gltf-load-${nextGltfModelNumber}`)
      }
      scene = await buildScene(context, controlledOptions.scene)
      const extensions: GltfRuntimeExtension[] = []
      const extension = await controlledOptions.animation?.finalize?.({ document, scene, nodes: context.nodes, readAccessor: index => readAccessor(document, buffers, index, Float32Array) as Float32Array })
      if (extension) extensions.push(extension)
      if (!controlledOptions.animation && controlledOptions.staticBatching !== false) {
        const configuration = typeof controlledOptions.staticBatching === 'object' ? controlledOptions.staticBatching : {}
        const result = batchStaticMeshes(scene, { minInstances: configuration.minInstances ?? 3 })
        if (result.batches > 0) extensions.push({ id: 'sekai64.static-batching', value: Object.freeze(result) })
      }
      return new GltfAsset(scene, document, leases, [...ownedTextures], extensions)
    } catch (error) {
      if (!controller.signal.aborted) controller.abort(error)
      if (context?.pendingTextures.size) await Promise.allSettled([...context.pendingTextures])
      scene?.dispose()
      for (const texture of ownedTextures) texture.dispose()
      for (const lease of leases) lease.dispose()
      throw error
    } finally {
      stopForwardingAbort()
    }
  }

  async loadNode(source: string | URL, options: GltfLoadOptions & { id?: string; name?: string } = {}): Promise<GltfModelNode> {
    const id = options.id ?? `gltf-model-${nextGltfModelNumber++}`
    const asset = await this.load(source, { ...options, nodeIdPrefix: options.nodeIdPrefix ?? id })
    return new GltfModelNode(asset, { id, name: options.name })
  }

  dispose(): void { if (this.ownsAssets) this.assets.dispose() }
}

export interface LoadModelOptions extends GltfLoadOptions {
  assets?: AssetManager
  id?: string
  name?: string
}

/** One-call model loading with ownership tied to the returned node. */
export async function loadModel(source: string | URL, options: LoadModelOptions = {}): Promise<GltfModelNode> {
  const loader = new GltfLoader(options.assets)
  try {
    const node = await loader.loadNode(source, options)
    if (!options.assets) node.asset.onDispose(() => loader.dispose())
    return node
  } catch (error) {
    if (!options.assets) loader.dispose()
    throw error
  }
}

function isBinaryGltfPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return lower.endsWith('.glb') || lower.endsWith('.vrm')
}

async function loadBuffers(
  document: GltfDocument,
  binaryChunk: ArrayBuffer | undefined,
  sourceUrl: URL,
  assets: AssetManager,
  leases: AssetLease<unknown>[],
  options: GltfLoadOptions
): Promise<ArrayBuffer[]> {
  const buffers: ArrayBuffer[] = []
  for (let index = 0; index < (document.buffers?.length ?? 0); index += 1) {
    const definition = document.buffers?.[index]
    if (!definition) throw new Error(`glTF buffer ${index} is missing.`)
    if (!definition.uri) {
      if (index !== 0 || !binaryChunk) throw new Error(`glTF buffer ${index} has no URI and no matching GLB binary chunk.`)
      buffers.push(binaryChunk)
    } else if (definition.uri.startsWith('data:')) {
      buffers.push(toOwnedArrayBuffer(decodeDataUri(definition.uri).bytes))
    } else {
      const lease = await assets.loadArrayBuffer(new URL(definition.uri, sourceUrl), options)
      leases.push(lease)
      buffers.push(lease.value)
    }
  }
  return buffers
}

async function buildScene(context: GltfLoadContext, requestedScene?: number): Promise<Scene> {
  const { document } = context
  const sceneIndex = requestedScene ?? document.scene ?? 0
  const definition = document.scenes?.[sceneIndex]
  if (!definition) throw new Error(`glTF scene ${sceneIndex} does not exist.`)
  const scene = new Scene({ name: definition.name ?? 'glTF Scene', autoDisposeResources: true })
  const cache = new Map<number, Promise<Node>>()
  const createNode = async (index: number): Promise<Node> => {
    const cached = cache.get(index)
    if (cached) return (await cached).clone(true)
    const pending = (async (): Promise<Node> => {
      const source = document.nodes?.[index]
      if (!source) throw new Error(`glTF node ${index} does not exist.`)
      const root = source.mesh === undefined
        ? new Node({ id: gltfNodeId(context, `node-${index}`), name: source.name ?? '' })
        : await buildMeshNode(context, source.mesh, index, source.name, source.skin)
      applyTransform(root, source)
      for (const child of source.children ?? []) root.add(await createNode(child))
      const values = context.nodes.get(index) ?? []
      values.push(root)
      context.nodes.set(index, values)
      return root
    })()
    cache.set(index, pending)
    return pending
  }
  for (const node of definition.nodes ?? []) scene.add(await createNode(node))
  return scene
}

async function buildMeshNode(context: GltfLoadContext, meshIndex: number, nodeIndex: number, name?: string, skinIndex?: number): Promise<Node> {
  const source = context.document.meshes?.[meshIndex]
  if (!source) throw new Error(`glTF mesh ${meshIndex} does not exist.`)
  if (source.primitives.length === 1) return createPrimitive(context, source.primitives[0] as GltfPrimitive, gltfNodeId(context, `node-${nodeIndex}`), name ?? source.name, nodeIndex, meshIndex, 0, skinIndex, source.weights ?? context.document.nodes?.[nodeIndex]?.weights)
  const group = new Node({ id: gltfNodeId(context, `node-${nodeIndex}`), name: name ?? source.name ?? '' })
  for (let index = 0; index < source.primitives.length; index += 1) {
    const primitive = source.primitives[index]
    if (!primitive) continue
    group.add(await createPrimitive(context, primitive, gltfNodeId(context, `node-${nodeIndex}-primitive-${index}`), `${source.name ?? 'mesh'} primitive ${index}`, nodeIndex, meshIndex, index, skinIndex, source.weights ?? context.document.nodes?.[nodeIndex]?.weights))
  }
  return group
}

async function createPrimitive(context: GltfLoadContext, primitive: GltfPrimitive, id: string, name: string | undefined, nodeIndex: number, meshIndex: number, primitiveIndex: number, skinIndex?: number, defaultWeights: readonly number[] = []): Promise<Mesh> {
  const { document, buffers } = context
  if ((primitive.mode ?? 4) !== 4) throw new Error(`Sekai64 glTF loader currently supports TRIANGLES mode only; received ${primitive.mode}.`)
  const positionAccessor = primitive.attributes.POSITION
  if (positionAccessor === undefined) throw new Error(`glTF primitive ${id} has no POSITION attribute.`)
  const dracoExtension = resolveDracoExtension(primitive.extensions?.KHR_draco_mesh_compression)
  let positions: Float32Array
  let normals: Float32Array | undefined
  let uvs: Float32Array | undefined
  let uvs1: Float32Array | undefined
  let tangents: Float32Array | undefined
  let colors: Float32Array | undefined
  let indices: Uint16Array | Uint32Array | undefined
  if (dracoExtension) {
    const draco = resolveDracoDecoder(context.options)
    if (!draco) throw new Error('SEKAI64_GLTF_DRACO_DECODER_REQUIRED: KHR_draco_mesh_compression decoding is disabled. Set draco: "auto" or provide a GltfDracoDecoder.')
    const compressed = getBufferViewBytes(document, buffers, dracoExtension.bufferView)
    const decoded = await draco.decode({
      data: toOwnedArrayBuffer(compressed),
      attributes: dracoExtension.attributes,
      ...(context.options.signal ? { signal: context.options.signal } : {}),
    })
    positions = requiredDecodedAttribute(decoded, 'POSITION', id)
    normals = decoded.attributes.NORMAL
    uvs = decoded.attributes.TEXCOORD_0
    uvs1 = decoded.attributes.TEXCOORD_1
    tangents = decoded.attributes.TANGENT
    colors = decoded.attributes.COLOR_0
    indices = decoded.indices
  } else {
    positions = readAccessor(document, buffers, positionAccessor, Float32Array) as Float32Array
    normals = readOptionalFloatAccessor(document, buffers, primitive.attributes.NORMAL)
    uvs = readOptionalFloatAccessor(document, buffers, primitive.attributes.TEXCOORD_0)
    uvs1 = readOptionalFloatAccessor(document, buffers, primitive.attributes.TEXCOORD_1)
    tangents = readOptionalFloatAccessor(document, buffers, primitive.attributes.TANGENT)
    colors = readVertexColors(document, buffers, primitive.attributes.COLOR_0)
    if (primitive.indices !== undefined) {
      const accessor = document.accessors?.[primitive.indices]
      if (!accessor) throw new Error(`glTF index accessor ${primitive.indices} does not exist.`)
      if (![5121, 5123, 5125].includes(accessor.componentType)) throw new Error(`glTF index accessor ${primitive.indices} uses unsupported component type ${accessor.componentType}.`)
      indices = accessor.componentType === 5125
        ? readAccessor(document, buffers, primitive.indices, Uint32Array) as Uint32Array
        : readAccessor(document, buffers, primitive.indices, Uint16Array) as Uint16Array
    }
  }
  const material = await createMaterial(context, primitive.material)
  validateTextureCoordinates(material, { uvs, uvs1 }, id)
  if (material.normalTexture && !tangents) emitDiagnostic(context, {
    severity: 'warning',
    code: 'SEKAI_GLTF_NORMAL_TANGENT_MISSING',
    message: `Primitive ${id} has a normal texture but no TANGENT attribute; Sekai64 will reconstruct the tangent basis from derivatives.`,
    source: context.sourceUrl.href,
    materialIndex: primitive.material,
    materialName: material.label,
    primitiveId: id
  })
  const base: GeometryData = { positions, ...(normals ? { normals } : {}), ...(uvs ? { uvs } : {}), ...(uvs1 ? { uvs1 } : {}), ...(colors ? { colors } : {}), ...(tangents ? { tangents } : {}), ...(indices ? { indices } : {}) }
  const jointIndices = readOptionalFloatAccessor(document, buffers, primitive.attributes.JOINTS_0)
  const jointWeights = readOptionalFloatAccessor(document, buffers, primitive.attributes.WEIGHTS_0)
  const morphTargets = (primitive.targets ?? []).map((target, index) => ({
    name: `target-${index}`,
    ...(target.POSITION !== undefined ? { positions: readAccessor(document, buffers, target.POSITION, Float32Array) as Float32Array } : {}),
    ...(target.NORMAL !== undefined ? { normals: readAccessor(document, buffers, target.NORMAL, Float32Array) as Float32Array } : {}),
  }))
  const animated = Boolean(jointIndices || jointWeights || morphTargets.length > 0 || skinIndex !== undefined)
  if (animated && !context.options.animation && (context.options.animatedFallback ?? 'error') === 'error') throw new Error('SEKAI64_GLTF_ANIMATION_MODULE_REQUIRED: Animated glTF content requires an explicit @blcklab/sekai64/animation adapter, or animatedFallback: "static-pose".')
  const animationData: GltfPrimitiveAnimationData = { id, nodeIndex, meshIndex, primitiveIndex, ...(skinIndex !== undefined ? { skinIndex } : {}), base, ...(jointIndices ? { jointIndices } : {}), ...(jointWeights ? { jointWeights } : {}), morphTargets, defaultWeights }
  const geometry = context.options.animation && animated ? context.options.animation.createGeometry(animationData) : new Geometry(base, `${id}:geometry`)
  const mesh = new Mesh({ id, name, geometry, material, ownsResources: true, tags: animated ? ['gltf-mesh', 'gltf-animated'] : ['gltf-mesh'] })
  if (context.options.animation && animated) context.options.animation.bindMesh?.(mesh, animationData)
  return mesh
}

async function createMaterial(context: GltfLoadContext, materialIndex: number | undefined): Promise<StandardMaterial> {
  const source = materialIndex === undefined ? undefined : context.document.materials?.[materialIndex]
  if (materialIndex !== undefined && !source) throw new Error(`glTF material ${materialIndex} does not exist.`)
  const pbr = source?.pbrMetallicRoughness
  if (source?.alphaMode !== undefined && !['OPAQUE', 'MASK', 'BLEND'].includes(source.alphaMode)) {
    throw new Error(`glTF material ${materialIndex ?? 'default'} uses unsupported alphaMode ${source.alphaMode}.`)
  }
  // glTF color factors are defined in linear space. StandardMaterial's scalar
  // color inputs follow Sekai64's authoring/UI contract (sRGB), and the PBR
  // shaders linearize those uniforms before lighting. Encode imported glTF
  // factors once here so the shader recovers the exact linear factor instead
  // of incorrectly darkening it a second time.
  const baseLinear = pbr?.baseColorFactor ?? [1, 1, 1, 1]
  const emissiveLinear = source?.emissiveFactor ?? [0, 0, 0]
  const base = linearFactor4ToSrgb(baseLinear)
  const emissive = linearFactor3ToSrgb(emissiveLinear)
  const mtoonSource = record(source?.extensions?.VRMC_materials_mtoon)
  const legacyMtoon = mtoonSource ? undefined : resolveLegacyVrmMToon(context.document, materialIndex)
  const shadeTextureInfo = textureInfo(mtoonSource?.shadeMultiplyTexture) ?? legacyMtoon?.shadeTexture
  const shadingShiftTextureInfo = textureInfo(mtoonSource?.shadingShiftTexture) ?? legacyMtoon?.shadingShiftTexture
  const matcapTextureInfo = textureInfo(mtoonSource?.matcapTexture) ?? legacyMtoon?.matcapTexture
  const rimTextureInfo = textureInfo(mtoonSource?.rimMultiplyTexture) ?? legacyMtoon?.rimTexture
  const [baseColorTexture, metallicRoughnessTexture, normalTexture, emissiveTexture, occlusionTexture, mtoonShadeTexture, mtoonShadingShiftTexture, mtoonMatcapTexture, mtoonRimTexture] = await Promise.all([
    resolveGltfTexture(pbr?.baseColorTexture, context, 'srgb', 'base-color', materialIndex, source?.name),
    resolveGltfTexture(pbr?.metallicRoughnessTexture, context, 'linear', 'metallic-roughness', materialIndex, source?.name),
    resolveGltfTexture(source?.normalTexture, context, 'linear', 'normal', materialIndex, source?.name),
    resolveGltfTexture(source?.emissiveTexture, context, 'srgb', 'emissive', materialIndex, source?.name),
    resolveGltfTexture(source?.occlusionTexture, context, 'linear', 'occlusion', materialIndex, source?.name),
    resolveGltfTexture(shadeTextureInfo, context, 'srgb', 'mtoon-shade', materialIndex, source?.name),
    resolveGltfTexture(shadingShiftTextureInfo, context, 'linear', 'mtoon-shading-shift', materialIndex, source?.name),
    resolveGltfTexture(matcapTextureInfo, context, 'srgb', 'mtoon-matcap', materialIndex, source?.name),
    resolveGltfTexture(rimTextureInfo, context, 'srgb', 'mtoon-rim', materialIndex, source?.name)
  ])
  const mtoon = resolveMToonExtension(mtoonSource) ?? legacyMtoon?.mtoon
  const face = resolveFaceShadowExtension(source?.extensions?.SEKAI64_face_shadow ?? source?.extras?.sekai64FaceShadow)
  const clearcoat = record(source?.extensions?.KHR_materials_clearcoat)
  const sheen = record(source?.extensions?.KHR_materials_sheen)
  const specular = record(source?.extensions?.KHR_materials_specular)
  const transmission = record(source?.extensions?.KHR_materials_transmission)
  const volume = record(source?.extensions?.KHR_materials_volume)
  const ior = record(source?.extensions?.KHR_materials_ior)
  const emissiveStrength = finite(record(source?.extensions?.KHR_materials_emissive_strength)?.emissiveStrength) ?? 1
  const lightMap = resolveLightMapExtension(source?.extensions?.SEKAI64_lightmap ?? source?.extras?.sekai64LightMap)
  const water = resolveWaterExtension(source?.extensions?.SEKAI64_water ?? source?.extras?.sekai64Water)
  const [faceShadowTexture, lightMapTexture] = await Promise.all([
    resolveGltfTexture(face?.texture, context, 'linear', 'face-shadow', materialIndex, source?.name),
    resolveGltfTexture(lightMap?.texture, context, 'srgb', 'light-map', materialIndex, source?.name),
  ])
  const characterRole = mtoon ? inferCharacterMaterialRole(source?.name) : 'generic'
  return new StandardMaterial({
    label: source?.name,
    baseColor: [base[0] ?? 1, base[1] ?? 1, base[2] ?? 1, base[3] ?? 1],
    baseColorTexture,
    baseColorTexCoord: toTexCoord(pbr?.baseColorTexture?.texCoord),
    metallic: pbr?.metallicFactor ?? 1,
    roughness: pbr?.roughnessFactor ?? 1,
    metallicRoughnessTexture,
    metallicRoughnessTexCoord: toTexCoord(pbr?.metallicRoughnessTexture?.texCoord),
    normalTexture,
    normalTexCoord: toTexCoord(source?.normalTexture?.texCoord),
    normalScale: source?.normalTexture?.scale ?? 1,
    emissive: [emissive[0] ?? 0, emissive[1] ?? 0, emissive[2] ?? 0],
    emissiveTexture,
    emissiveTexCoord: toTexCoord(source?.emissiveTexture?.texCoord),
    emissiveIntensity: emissiveStrength,
    occlusionTexture,
    occlusionTexCoord: toTexCoord(source?.occlusionTexture?.texCoord),
    occlusionStrength: source?.occlusionTexture?.strength ?? 1,
    lightMapTexture,
    lightMapTexCoord: toTexCoord(lightMap?.texCoord ?? 1),
    lightMapIntensity: lightMap?.intensity ?? 1,
    specularFactor: finite(specular?.specularFactor) ?? 1,
    specularColor: linearFactor3ToSrgb(color3(specular?.specularColorFactor) ?? [1, 1, 1]),
    clearcoat: finite(clearcoat?.clearcoatFactor) ?? 0,
    clearcoatRoughness: finite(clearcoat?.clearcoatRoughnessFactor) ?? 0.1,
    sheenColor: linearFactor3ToSrgb(color3(sheen?.sheenColorFactor) ?? [1, 1, 1]),
    sheenIntensity: color3(sheen?.sheenColorFactor) ? 1 : 0,
    sheenRoughness: finite(sheen?.sheenRoughnessFactor) ?? 0.5,
    transmission: finite(transmission?.transmissionFactor) ?? 0,
    ior: finite(ior?.ior) ?? 1.5,
    thickness: finite(volume?.thicknessFactor) ?? 0,
    attenuationColor: linearFactor3ToSrgb(color3(volume?.attenuationColor) ?? [1, 1, 1]),
    attenuationDistance: finite(volume?.attenuationDistance) ?? 1e20,
    alphaMode: source?.alphaMode === 'BLEND' ? 'blend' : source?.alphaMode === 'MASK' ? 'mask' : 'opaque',
    alphaCutoff: source?.alphaCutoff ?? 0.5,
    doubleSided: source?.doubleSided ?? false,
    shadingModel: water ? 'water' : mtoon ? 'mtoon' : 'pbr',
    alphaDither: Boolean(source?.extras?.alphaDither),
    ...(water ? { water } : {}),
    ...(characterRole !== 'generic' ? { character: { role: characterRole } } : {}),
    ...(mtoon || face ? { mtoon: {
      ...mtoon,
      ...(mtoonShadeTexture ? { shadeTexture: mtoonShadeTexture, shadeTexCoord: toTexCoord(shadeTextureInfo?.texCoord) } : {}),
      ...(mtoonShadingShiftTexture ? { shadingShiftTexture: mtoonShadingShiftTexture, shadingShiftTexCoord: toTexCoord(shadingShiftTextureInfo?.texCoord), shadingShiftTextureScale: finite(record(mtoonSource?.shadingShiftTexture)?.scale) ?? legacyMtoon?.shadingShiftTextureScale ?? 1 } : {}),
      ...(mtoonMatcapTexture ? { matcapTexture: mtoonMatcapTexture, matcapTexCoord: toTexCoord(matcapTextureInfo?.texCoord) } : {}),
      ...(mtoonRimTexture ? { rimTexture: mtoonRimTexture, rimTexCoord: toTexCoord(rimTextureInfo?.texCoord) } : {}),
      ...(faceShadowTexture ? { faceShadowTexture } : {}),
      ...(face?.texCoord !== undefined ? { faceShadowTexCoord: toTexCoord(face.texCoord) } : {}),
      ...(face?.strength !== undefined ? { faceShadowStrength: face.strength } : {}),
      ...(face?.flipX !== undefined ? { faceShadowFlipX: face.flipX } : {}),
      ...(face?.hairDepthWrite !== undefined ? { hairDepthWrite: face.hairDepthWrite } : {}),
      ...(face?.hairAlphaDither !== undefined ? { hairAlphaDither: face.hairAlphaDither } : {}),
      ...(face?.sortBias !== undefined ? { transparentSortBias: face.sortBias } : {})
    } } : {}),
    ownsTextures: false
  })
}

function linearChannelToSrgb(value: number): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(0, value)
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
}

function linearFactor3ToSrgb(value: readonly number[]): [number, number, number] {
  return [
    linearChannelToSrgb(value[0] ?? 0),
    linearChannelToSrgb(value[1] ?? 0),
    linearChannelToSrgb(value[2] ?? 0),
  ]
}

function linearFactor4ToSrgb(value: readonly number[]): [number, number, number, number] {
  const rgb = linearFactor3ToSrgb(value)
  return [rgb[0], rgb[1], rgb[2], value[3] ?? 1]
}

interface LegacyVrmMToon {
  mtoon: import('@sekai64-internal/materials').MToonShadingOptions
  shadeTexture?: GltfTextureInfo
  shadingShiftTexture?: GltfTextureInfo
  shadingShiftTextureScale?: number
  matcapTexture?: GltfTextureInfo
  rimTexture?: GltfTextureInfo
}

/**
 * VRM 0.x stored Unity MToon properties in extensions.VRM.materialProperties,
 * parallel to glTF's materials array. Keep this compatibility bridge narrow:
 * only values with a direct visual analogue in the VRM 1.0 MToon path are
 * translated. Legacy UV animation and Unity-only render-state properties are
 * intentionally not guessed here.
 */
function resolveLegacyVrmMToon(document: GltfDocument, materialIndex: number | undefined): LegacyVrmMToon | undefined {
  if (materialIndex === undefined) return undefined
  const vrm = record(document.extensions?.VRM)
  const properties = Array.isArray(vrm?.materialProperties) ? vrm.materialProperties : undefined
  const property = properties ? record(properties[materialIndex]) : undefined
  if (!property || typeof property.shader !== 'string' || !property.shader.toLowerCase().includes('mtoon')) return undefined

  const floats = record(property.floatProperties) ?? {}
  const vectors = record(property.vectorProperties) ?? {}
  const textures = record(property.textureProperties) ?? {}
  const linearColor = (key: string): [number, number, number] | undefined => {
    const value = color3(vectors[key])
    return value ? linearFactor3ToSrgb(value) : undefined
  }
  const legacyTexture = (key: string): GltfTextureInfo | undefined => {
    const value = textures[key]
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? { index: value } : undefined
  }
  const outlineModeValue = finite(floats._OutlineWidthMode)
  const outlineWidthMode = outlineModeValue === 1
    ? 'worldCoordinates'
    : outlineModeValue === 2
      ? 'screenCoordinates'
      : 'none'

  const mtoon: import('@sekai64-internal/materials').MToonShadingOptions = {
    ...(linearColor('_ShadeColor') ? { shadeColor: linearColor('_ShadeColor') } : {}),
    ...(finite(floats._ShadeShift) !== undefined ? { shadingShift: finite(floats._ShadeShift) } : {}),
    ...(finite(floats._ShadeToony) !== undefined ? { shadingToony: finite(floats._ShadeToony) } : {}),
    ...(linearColor('_RimColor') ? { parametricRimColor: linearColor('_RimColor') } : {}),
    ...(finite(floats._RimLightingMix) !== undefined ? { rimLightingMix: finite(floats._RimLightingMix) } : {}),
    ...(finite(floats._RimFresnelPower) !== undefined ? { rimFresnelPower: finite(floats._RimFresnelPower) } : {}),
    ...(finite(floats._RimLift) !== undefined ? { rimLift: finite(floats._RimLift) } : {}),
    outlineWidthMode,
    ...(finite(floats._OutlineWidth) !== undefined ? { outlineWidth: finite(floats._OutlineWidth) } : {}),
    ...(linearColor('_OutlineColor') ? { outlineColor: linearColor('_OutlineColor') } : {}),
    ...(finite(floats._OutlineLightingMix) !== undefined ? { outlineLightingMix: finite(floats._OutlineLightingMix) } : {}),
  }

  return {
    mtoon,
    ...(legacyTexture('_ShadeTexture') ? { shadeTexture: legacyTexture('_ShadeTexture') } : {}),
    ...(legacyTexture('_SphereAdd') ? { matcapTexture: legacyTexture('_SphereAdd') } : {}),
    ...(legacyTexture('_RimTexture') ? { rimTexture: legacyTexture('_RimTexture') } : {}),
  }
}

function resolveMToonExtension(value: unknown): import('@sekai64-internal/materials').MToonShadingOptions | undefined {
  const source = record(value)
  if (!source) return undefined
  const linearColor = (candidate: unknown): [number, number, number] | undefined => {
    const value = color3(candidate)
    return value ? linearFactor3ToSrgb(value) : undefined
  }
  const outlineWidthMode = source.outlineWidthMode === 'worldCoordinates' || source.outlineWidthMode === 'screenCoordinates' || source.outlineWidthMode === 'none'
    ? source.outlineWidthMode
    : undefined
  return {
    ...(linearColor(source.shadeColorFactor) ? { shadeColor: linearColor(source.shadeColorFactor) } : {}),
    ...(finite(source.shadingShiftFactor) !== undefined ? { shadingShift: finite(source.shadingShiftFactor) } : {}),
    ...(finite(source.shadingToonyFactor) !== undefined ? { shadingToony: finite(source.shadingToonyFactor) } : {}),
    ...(finite(source.giEqualizationFactor) !== undefined ? { giEqualization: finite(source.giEqualizationFactor) } : {}),
    ...(linearColor(source.matcapFactor) ? { matcapColor: linearColor(source.matcapFactor) } : {}),
    ...(linearColor(source.parametricRimColorFactor) ? { parametricRimColor: linearColor(source.parametricRimColorFactor) } : {}),
    ...(finite(source.rimLightingMixFactor) !== undefined ? { rimLightingMix: finite(source.rimLightingMixFactor) } : {}),
    ...(finite(source.parametricRimFresnelPowerFactor) !== undefined ? { rimFresnelPower: finite(source.parametricRimFresnelPowerFactor) } : {}),
    ...(finite(source.parametricRimLiftFactor) !== undefined ? { rimLift: finite(source.parametricRimLiftFactor) } : {}),
    ...(outlineWidthMode ? { outlineWidthMode } : {}),
    ...(finite(source.outlineWidthFactor) !== undefined ? { outlineWidth: finite(source.outlineWidthFactor) } : {}),
    ...(linearColor(source.outlineColorFactor) ? { outlineColor: linearColor(source.outlineColorFactor) } : {}),
    ...(finite(source.outlineLightingMixFactor) !== undefined ? { outlineLightingMix: finite(source.outlineLightingMixFactor) } : {}),
    ...(typeof source.transparentWithZWrite === 'boolean' ? { transparentWithZWrite: source.transparentWithZWrite } : {}),
    ...(finite(source.renderQueueOffsetNumber) !== undefined ? { renderQueueOffset: finite(source.renderQueueOffsetNumber) } : {}),
  }
}



interface LightMapExtension { texture?: GltfTextureInfo; texCoord?: number; intensity?: number }
function resolveLightMapExtension(value: unknown): LightMapExtension | undefined {
  const source = record(value); if (!source) return undefined
  return { ...(textureInfo(source.texture) ? { texture: textureInfo(source.texture) } : {}), ...(finite(source.texCoord) !== undefined ? { texCoord: finite(source.texCoord) } : {}), ...(finite(source.intensity) !== undefined ? { intensity: finite(source.intensity) } : {}) }
}

function resolveWaterExtension(value: unknown): import('@sekai64-internal/materials').WaterShadingOptions | undefined {
  const source = record(value); if (!source) return undefined
  return { ...(color3(source.shallowColor) ? { shallowColor: color3(source.shallowColor) } : {}), ...(color3(source.deepColor) ? { deepColor: color3(source.deepColor) } : {}), ...(color3(source.foamColor) ? { foamColor: color3(source.foamColor) } : {}), ...(finite(source.fresnelPower) !== undefined ? { fresnelPower: finite(source.fresnelPower) } : {}), ...(finite(source.reflectionStrength) !== undefined ? { reflectionStrength: finite(source.reflectionStrength) } : {}), ...(finite(source.absorptionStrength) !== undefined ? { absorptionStrength: finite(source.absorptionStrength) } : {}) }
}

function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
function finite(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined }
function color3(value: unknown): [number, number, number] | undefined { if (!Array.isArray(value) || value.length < 3) return undefined; const output=value.slice(0,3).map(Number); return output.every(Number.isFinite) ? output as [number,number,number] : undefined }
function textureInfo(value: unknown): GltfTextureInfo | undefined { if (typeof value === 'number' && Number.isInteger(value)) return { index:value }; const source=record(value); return source && typeof source.index==='number' && Number.isInteger(source.index) ? { index:source.index, ...(typeof source.texCoord==='number' ? {texCoord:source.texCoord}: {}) } : undefined }

interface FaceShadowExtension {
  texture?: GltfTextureInfo
  texCoord?: number
  strength?: number
  flipX?: boolean
  hairDepthWrite?: boolean
  hairAlphaDither?: boolean
  sortBias?: number
}
function resolveFaceShadowExtension(value: unknown): FaceShadowExtension | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const textureSource = source.texture
  let texture: GltfTextureInfo | undefined
  if (typeof textureSource === 'number' && Number.isInteger(textureSource)) texture = { index: textureSource }
  else if (textureSource && typeof textureSource === 'object' && !Array.isArray(textureSource)) {
    const candidate = textureSource as Record<string, unknown>
    if (typeof candidate.index === 'number' && Number.isInteger(candidate.index)) texture = { index: candidate.index, ...(typeof candidate.texCoord === 'number' ? { texCoord: candidate.texCoord } : {}) }
  }
  const finite = (candidate: unknown): number | undefined => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
  const boolean = (candidate: unknown): boolean | undefined => typeof candidate === 'boolean' ? candidate : undefined
  return {
    ...(texture ? { texture } : {}),
    ...(finite(source.texCoord) !== undefined ? { texCoord: finite(source.texCoord) } : {}),
    ...(finite(source.strength) !== undefined ? { strength: finite(source.strength) } : {}),
    ...(boolean(source.flipX) !== undefined ? { flipX: boolean(source.flipX) } : {}),
    ...(boolean(source.hairDepthWrite) !== undefined ? { hairDepthWrite: boolean(source.hairDepthWrite) } : {}),
    ...(boolean(source.hairAlphaDither) !== undefined ? { hairAlphaDither: boolean(source.hairAlphaDither) } : {}),
    ...(finite(source.sortBias) !== undefined ? { sortBias: finite(source.sortBias) } : {}),
  }
}

type TextureUsage = 'base-color' | 'normal' | 'metallic-roughness' | 'emissive' | 'occlusion' | 'face-shadow' | 'light-map' | 'mtoon-shade' | 'mtoon-shading-shift' | 'mtoon-matcap' | 'mtoon-rim'

async function resolveGltfTexture(
  textureInfo: GltfTextureInfo | undefined,
  context: GltfLoadContext,
  colorSpace: TextureColorSpace,
  usage: TextureUsage,
  materialIndex?: number,
  materialName?: string
): Promise<Texture | undefined> {
  if (!textureInfo) return undefined
  toTexCoord(textureInfo.texCoord)
  const textureIndex = textureInfo.index
  const definition = context.document.textures?.[textureIndex]
  if (!definition) throw gltfError('SEKAI_GLTF_TEXTURE_INDEX_INVALID', `glTF texture ${textureIndex} does not exist.`)
  const imageSource = resolveTextureImageSource(definition)
  if (imageSource === undefined) throw gltfError('SEKAI_GLTF_TEXTURE_SOURCE_INVALID', `glTF texture ${textureIndex} does not reference an image source.`)
  const sampler = resolveSampler(context.document.samplers?.[definition.sampler ?? -1], definition.sampler)
  const key = [textureIndex, colorSpace, sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT].join(':')
  let pending = context.textureCache.get(key)
  if (!pending) {
    pending = (async (): Promise<Texture> => {
      const source = await resolveImageSource(imageSource, context)
      const texture = new Texture({
        source,
        label: definition.name ?? `${usage} texture ${textureIndex}`,
        colorSpace,
        flipY: false,
        minFilter: sampler.minFilter,
        magFilter: sampler.magFilter,
        wrapS: sampler.wrapS,
        wrapT: sampler.wrapT,
        generateMipmaps: sampler.generateMipmaps
      })
      context.ownedTextures.add(texture)
      try {
        await texture.load({ signal: context.options.signal, ...context.options.texture })
        return texture
      } catch (error) {
        context.ownedTextures.delete(texture)
        texture.dispose()
        throw gltfError('SEKAI_GLTF_TEXTURE_DECODE_FAILED', `Failed to decode glTF ${usage} texture ${textureIndex}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })()
    context.textureCache.set(key, pending)
    context.pendingTextures.add(pending)
    pending.then(
      () => context.pendingTextures.delete(pending as Promise<Texture>),
      () => {
        context.pendingTextures.delete(pending as Promise<Texture>)
        context.textureCache.delete(key)
      }
    )
  }
  const texture = await pending
  if (materialIndex !== undefined && textureInfo.texCoord !== undefined && textureInfo.texCoord !== 0 && textureInfo.texCoord !== 1) {
    throw gltfError('SEKAI_GLTF_UV_SET_MISSING', `Material ${materialName ?? materialIndex} requests unsupported TEXCOORD_${textureInfo.texCoord}.`)
  }
  return texture
}

async function resolveImageSource(imageIndex: number, context: GltfLoadContext): Promise<TextureSource> {
  let pending = context.imageSources.get(imageIndex)
  if (pending) return pending
  pending = (async (): Promise<TextureSource> => {
    const image = context.document.images?.[imageIndex]
    if (!image) throw gltfError('SEKAI_GLTF_IMAGE_NOT_FOUND', `glTF image ${imageIndex} does not exist.`)
    if (image.uri !== undefined && image.bufferView !== undefined) throw gltfError('SEKAI_GLTF_TEXTURE_SOURCE_INVALID', `glTF image ${imageIndex} cannot declare both uri and bufferView.`)
    if (image.bufferView !== undefined) {
      const mimeType = normalizeImageMime(image.mimeType)
      const bytes = getBufferViewBytes(context.document, context.buffers, image.bufferView)
      return new Blob([toOwnedArrayBuffer(bytes)], { type: mimeType })
    }
    if (image.uri !== undefined) {
      if (image.uri.startsWith('data:')) {
        const decoded = decodeDataUri(image.uri)
        const mimeType = normalizeImageMime(decoded.mimeType)
        return new Blob([toOwnedArrayBuffer(decoded.bytes)], { type: mimeType })
      }
      const resolved = new URL(image.uri, context.sourceUrl)
      try {
        const lease = await context.assets.loadBlob(resolved, context.options)
        context.leases.push(lease)
        const declaredMime = image.mimeType || lease.value.type
        if (declaredMime && declaredMime !== 'application/octet-stream') normalizeImageMime(declaredMime)
        else inferImageMimeFromUrl(resolved)
        return lease.value
      } catch (error) {
        throw gltfError('SEKAI_GLTF_IMAGE_NOT_FOUND', `Failed to load glTF image ${imageIndex} (${image.uri} → ${resolved.href}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    throw gltfError('SEKAI_GLTF_TEXTURE_SOURCE_INVALID', `glTF image ${imageIndex} has neither uri nor bufferView.`)
  })()
  context.imageSources.set(imageIndex, pending)
  pending.catch(() => context.imageSources.delete(imageIndex))
  return pending
}

export function getBufferViewBytes(document: GltfDocument, buffers: readonly ArrayBuffer[], bufferViewIndex: number): Uint8Array {
  const view = document.bufferViews?.[bufferViewIndex]
  if (!view) throw gltfError('SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID', `glTF bufferView ${bufferViewIndex} does not exist.`)
  const buffer = buffers[view.buffer]
  if (!buffer) throw gltfError('SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID', `glTF buffer ${view.buffer} referenced by bufferView ${bufferViewIndex} is unavailable.`)
  const offset = view.byteOffset ?? 0
  const end = offset + view.byteLength
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(view.byteLength) || offset < 0 || view.byteLength < 0 || end > buffer.byteLength) {
    throw gltfError('SEKAI_GLTF_IMAGE_BUFFER_VIEW_INVALID', `glTF bufferView ${bufferViewIndex} byte range ${offset}..${end} exceeds buffer ${view.buffer} length ${buffer.byteLength}.`)
  }
  return new Uint8Array(buffer, offset, view.byteLength)
}

function resolveTextureImageSource(texture: GltfTexture): number | undefined {
  const webp = record(texture.extensions?.EXT_texture_webp)
  const webpSource = webp?.source
  if (typeof webpSource === 'number' && Number.isInteger(webpSource) && webpSource >= 0) return webpSource
  return texture.source
}

interface ResolvedDracoExtension { bufferView: number; attributes: Readonly<Record<string, number>> }
function resolveDracoExtension(value: unknown): ResolvedDracoExtension | undefined {
  const source = record(value)
  if (!source) return undefined
  const bufferView = source.bufferView
  const attributesSource = record(source.attributes)
  if (typeof bufferView !== 'number' || !Number.isInteger(bufferView) || bufferView < 0 || !attributesSource) {
    throw new Error('KHR_draco_mesh_compression must declare a valid bufferView and attribute map.')
  }
  const attributes: Record<string, number> = {}
  for (const [semantic, id] of Object.entries(attributesSource)) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) throw new Error(`KHR_draco_mesh_compression attribute ${semantic} has an invalid unique id.`)
    attributes[semantic] = id
  }
  return { bufferView, attributes }
}

function requiredDecodedAttribute(decoded: GltfDracoDecodedPrimitive, semantic: string, primitiveId: string): Float32Array {
  const value = decoded.attributes[semantic]
  if (!value) throw new Error(`Draco decoder did not return required ${semantic} data for primitive ${primitiveId}.`)
  return value
}

function resolveSampler(source: GltfSampler | undefined, samplerIndex: number | undefined): {
  minFilter: TextureMinFilter
  magFilter: TextureMagFilter
  wrapS: TextureWrap
  wrapT: TextureWrap
  generateMipmaps: boolean
} {
  try {
    const minFilter = mapMinFilter(source?.minFilter)
    return {
      minFilter,
      magFilter: mapMagFilter(source?.magFilter),
      wrapS: mapWrap(source?.wrapS),
      wrapT: mapWrap(source?.wrapT),
      generateMipmaps: minFilter.includes('mipmap')
    }
  } catch (error) {
    throw gltfError('SEKAI_GLTF_SAMPLER_INVALID', `glTF sampler ${samplerIndex ?? 'default'} is invalid: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function mapWrap(value: number | undefined): TextureWrap {
  if (value === undefined || value === 10497) return 'repeat'
  if (value === 33071) return 'clamp-to-edge'
  if (value === 33648) return 'mirror-repeat'
  throw new Error(`unsupported wrap constant ${value}`)
}
function mapMagFilter(value: number | undefined): TextureMagFilter {
  if (value === undefined || value === 9729) return 'linear'
  if (value === 9728) return 'nearest'
  throw new Error(`unsupported magnification filter ${value}`)
}
function mapMinFilter(value: number | undefined): TextureMinFilter {
  if (value === undefined || value === 9987) return 'linear-mipmap-linear'
  if (value === 9728) return 'nearest'
  if (value === 9729) return 'linear'
  if (value === 9984) return 'nearest-mipmap-nearest'
  if (value === 9985) return 'linear-mipmap-nearest'
  if (value === 9986) return 'nearest-mipmap-linear'
  if (value === 9987) return 'linear-mipmap-linear'
  throw new Error(`unsupported minification filter ${value}`)
}

function normalizeImageMime(value: string | undefined): string {
  const mime = (value ?? '').split(';', 1)[0]?.trim().toLowerCase()
  if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp') return mime
  throw gltfError('SEKAI_GLTF_IMAGE_MIME_UNSUPPORTED', `Unsupported glTF image MIME type: ${value || 'missing'}. Supported types are image/png, image/jpeg, and image/webp.`)
}

function inferImageMimeFromUrl(url: URL): string | undefined {
  const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return undefined
}

function validateTextureCoordinates(material: StandardMaterial, geometry: { uvs?: Float32Array; uvs1?: Float32Array }, primitiveId: string): void {
  const requests: Array<[Texture | undefined, 0 | 1, string]> = [
    [material.baseColorTexture, material.baseColorTexCoord, 'base-color'],
    [material.metallicRoughnessTexture, material.metallicRoughnessTexCoord, 'metallic-roughness'],
    [material.normalTexture, material.normalTexCoord, 'normal'],
    [material.emissiveTexture, material.emissiveTexCoord, 'emissive'],
    [material.occlusionTexture, material.occlusionTexCoord, 'occlusion'],
    [material.mtoonShadeTexture, material.mtoonShadeTexCoord, 'mtoon-shade'],
    [material.mtoonShadingShiftTexture, material.mtoonShadingShiftTexCoord, 'mtoon-shading-shift'],
    [material.mtoonRimTexture, material.mtoonRimTexCoord, 'mtoon-rim']
  ]
  for (const [texture, set, usage] of requests) {
    if (!texture) continue
    if (set === 0 && !geometry.uvs) throw gltfError('SEKAI_GLTF_UV_SET_MISSING', `Primitive ${primitiveId} uses a ${usage} texture but has no TEXCOORD_0 attribute.`)
    if (set === 1 && !geometry.uvs1) throw gltfError('SEKAI_GLTF_UV_SET_MISSING', `Primitive ${primitiveId} uses a ${usage} texture but has no TEXCOORD_1 attribute.`)
  }
}

function inferCharacterMaterialRole(name: string | undefined): import('@sekai64-internal/materials').CharacterMaterialRole {
  const value = (name ?? '').trim().toLowerCase()
  if (!value) return 'generic'
  if (/(^|[\s_\-.])(eye|eyes|iris|pupil|cornea|sclera)([\s_\-.]|$)|瞳|目/.test(value)) return 'eye'
  if (/(^|[\s_\-.])(hair|bang|bangs|fringe|ponytail|eyelash|lashes)([\s_\-.]|$)|髪|まつ毛/.test(value)) return 'hair'
  if (/(^|[\s_\-.])(skin|face|facial|headskin|cheek)([\s_\-.]|$)|肌|顔/.test(value)) return 'skin'
  return 'generic'
}

function resolveDracoDecoder(options: GltfLoadOptions): GltfDracoDecoder | undefined {
  if (options.draco === false) return undefined
  if (options.draco && options.draco !== 'auto') return options.draco
  const browserOptions: BrowserDracoDecoderOptions = options.dracoDecoderPath ? { decoderPath: options.dracoDecoderPath } : {}
  return createBrowserDracoDecoder(browserOptions)
}

function readOptionalFloatAccessor(document: GltfDocument, buffers: readonly ArrayBuffer[], accessorIndex: number | undefined): Float32Array | undefined {
  return accessorIndex === undefined ? undefined : readAccessor(document, buffers, accessorIndex, Float32Array) as Float32Array
}

function readVertexColors(document: GltfDocument, buffers: readonly ArrayBuffer[], accessorIndex: number | undefined): Float32Array | undefined {
  if (accessorIndex === undefined) return undefined
  const accessor = document.accessors?.[accessorIndex]
  if (!accessor) throw new Error(`glTF color accessor ${accessorIndex} does not exist.`)
  if (accessor.type !== 'VEC3' && accessor.type !== 'VEC4') throw new Error(`glTF COLOR_0 accessor ${accessorIndex} must use VEC3 or VEC4.`)
  if ([5121, 5123].includes(accessor.componentType) && !accessor.normalized) throw new Error(`glTF integer COLOR_0 accessor ${accessorIndex} must be normalized.`)
  const values = readAccessor(document, buffers, accessorIndex, Float32Array) as Float32Array
  if (accessor.type === 'VEC4') return values
  const output = new Float32Array(accessor.count * 4)
  for (let index = 0; index < accessor.count; index += 1) {
    output[index * 4] = values[index * 3] ?? 1
    output[index * 4 + 1] = values[index * 3 + 1] ?? 1
    output[index * 4 + 2] = values[index * 3 + 2] ?? 1
    output[index * 4 + 3] = 1
  }
  return output
}

function applyTransform(node: Node, source: GltfNode): void {
  if (source.matrix) {
    if (source.matrix.length !== 16) throw new Error('glTF node matrix must contain 16 values.')
    decomposeMatrix(source.matrix, node)
    return
  }
  if (source.translation) node.position.fromArray(source.translation)
  if (source.scale) node.scale.fromArray(source.scale)
  if (source.rotation) quaternionToEuler(source.rotation, node.rotation)
}

function readAccessor<T extends Float32Array | Uint16Array | Uint32Array>(
  document: GltfDocument,
  buffers: readonly ArrayBuffer[],
  accessorIndex: number,
  Constructor: { new(length: number): T }
): T {
  const accessor = document.accessors?.[accessorIndex]
  if (!accessor) throw new Error(`glTF accessor ${accessorIndex} does not exist.`)
  if (!Number.isInteger(accessor.count) || accessor.count < 0) throw new Error(`glTF accessor ${accessorIndex} has invalid count ${accessor.count}.`)

  const components = componentCount(accessor.type)
  const output = new Constructor(accessor.count * components)

  // A sparse accessor is allowed to omit its base bufferView. In that case the
  // glTF 2.0 specification defines the base values as zero and the sparse
  // entries below overwrite only the changed elements.
  if (accessor.bufferView !== undefined) {
    readAccessorBase(document, buffers, accessorIndex, accessor, output, components)
  } else if ((accessor.byteOffset ?? 0) !== 0) {
    throw new Error(`glTF accessor ${accessorIndex} defines byteOffset without a bufferView.`)
  }

  if (accessor.sparse) applySparseAccessor(document, buffers, accessorIndex, accessor, output, components)
  return output
}

function readAccessorBase<T extends Float32Array | Uint16Array | Uint32Array>(
  document: GltfDocument,
  buffers: readonly ArrayBuffer[],
  accessorIndex: number,
  accessor: GltfAccessor,
  output: T,
  components: number
): void {
  const view = document.bufferViews?.[accessor.bufferView as number]
  if (!view) throw new Error(`glTF bufferView ${accessor.bufferView} does not exist.`)
  const buffer = buffers[view.buffer]
  if (!buffer) throw new Error(`glTF buffer ${view.buffer} is unavailable.`)
  const componentBytes = componentSize(accessor.componentType)
  const packedStride = accessorElementByteSize(accessor.type, accessor.componentType)
  const stride = view.byteStride ?? packedStride
  if (stride < packedStride) throw new Error(`glTF accessor ${accessorIndex} byteStride ${stride} is smaller than its packed element size ${packedStride}.`)
  if (view.byteStride !== undefined && view.byteStride % componentBytes !== 0) throw new Error(`glTF accessor ${accessorIndex} byteStride ${stride} is not aligned to component size ${componentBytes}.`)
  const accessorOffset = accessor.byteOffset ?? 0
  const offset = (view.byteOffset ?? 0) + accessorOffset
  const requiredLength = accessor.count === 0 ? 0 : (accessor.count - 1) * stride + packedStride
  assertBufferViewRange(document, buffers, accessor.bufferView as number, offset, requiredLength, `glTF accessor ${accessorIndex}`)
  if (requiredLength === 0) return
  const data = new DataView(buffer, offset, requiredLength)
  for (let item = 0; item < accessor.count; item += 1) {
    for (let component = 0; component < components; component += 1) {
      const componentOffset = accessorComponentByteOffset(accessor.type, accessor.componentType, component)
      const raw = readComponent(data, item * stride + componentOffset, accessor.componentType)
      output[item * components + component] = normalizeComponent(raw, accessor.componentType, accessor.normalized ?? false) as never
    }
  }
}

function applySparseAccessor<T extends Float32Array | Uint16Array | Uint32Array>(
  document: GltfDocument,
  buffers: readonly ArrayBuffer[],
  accessorIndex: number,
  accessor: GltfAccessor,
  output: T,
  components: number
): void {
  const sparse = accessor.sparse
  if (!sparse) return
  if (!Number.isInteger(sparse.count) || sparse.count < 0 || sparse.count > accessor.count) {
    throw new Error(`glTF accessor ${accessorIndex} sparse count ${sparse.count} must be between 0 and accessor count ${accessor.count}.`)
  }
  if (sparse.count === 0) return
  if (![5121, 5123, 5125].includes(sparse.indices.componentType)) {
    throw new Error(`glTF accessor ${accessorIndex} sparse indices use unsupported component type ${sparse.indices.componentType}; expected UNSIGNED_BYTE, UNSIGNED_SHORT, or UNSIGNED_INT.`)
  }

  const indexView = document.bufferViews?.[sparse.indices.bufferView]
  if (!indexView) throw new Error(`glTF sparse index bufferView ${sparse.indices.bufferView} does not exist.`)
  const indexBuffer = buffers[indexView.buffer]
  if (!indexBuffer) throw new Error(`glTF sparse index buffer ${indexView.buffer} is unavailable.`)
  const indexComponentBytes = componentSize(sparse.indices.componentType)
  const indexOffset = (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0)
  const indexLength = sparse.count * indexComponentBytes
  assertBufferViewRange(document, buffers, sparse.indices.bufferView, indexOffset, indexLength, `glTF accessor ${accessorIndex} sparse indices`)
  const indexData = new DataView(indexBuffer, indexOffset, indexLength)

  const valueView = document.bufferViews?.[sparse.values.bufferView]
  if (!valueView) throw new Error(`glTF sparse value bufferView ${sparse.values.bufferView} does not exist.`)
  const valueBuffer = buffers[valueView.buffer]
  if (!valueBuffer) throw new Error(`glTF sparse value buffer ${valueView.buffer} is unavailable.`)
  const sparseElementBytes = accessorElementByteSize(accessor.type, accessor.componentType)
  const valueOffset = (valueView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0)
  const valueLength = sparse.count * sparseElementBytes
  assertBufferViewRange(document, buffers, sparse.values.bufferView, valueOffset, valueLength, `glTF accessor ${accessorIndex} sparse values`)
  const valueData = new DataView(valueBuffer, valueOffset, valueLength)

  let previousIndex = -1
  for (let sparseItem = 0; sparseItem < sparse.count; sparseItem += 1) {
    const destinationIndex = readComponent(indexData, sparseItem * indexComponentBytes, sparse.indices.componentType)
    if (!Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex >= accessor.count) {
      throw new Error(`glTF accessor ${accessorIndex} sparse index ${destinationIndex} is outside accessor count ${accessor.count}.`)
    }
    if (destinationIndex <= previousIndex) {
      throw new Error(`glTF accessor ${accessorIndex} sparse indices must be strictly increasing.`)
    }
    previousIndex = destinationIndex
    for (let component = 0; component < components; component += 1) {
      const componentOffset = accessorComponentByteOffset(accessor.type, accessor.componentType, component)
      const raw = readComponent(valueData, sparseItem * sparseElementBytes + componentOffset, accessor.componentType)
      output[destinationIndex * components + component] = normalizeComponent(raw, accessor.componentType, accessor.normalized ?? false) as never
    }
  }
}

function assertBufferViewRange(
  document: GltfDocument,
  buffers: readonly ArrayBuffer[],
  bufferViewIndex: number,
  absoluteOffset: number,
  byteLength: number,
  label: string
): void {
  const view = document.bufferViews?.[bufferViewIndex]
  if (!view) throw new Error(`glTF bufferView ${bufferViewIndex} does not exist.`)
  const buffer = buffers[view.buffer]
  if (!buffer) throw new Error(`glTF buffer ${view.buffer} is unavailable.`)
  const viewStart = view.byteOffset ?? 0
  const viewEnd = viewStart + view.byteLength
  if (!Number.isInteger(absoluteOffset) || !Number.isInteger(byteLength) || absoluteOffset < viewStart || byteLength < 0 || absoluteOffset + byteLength > viewEnd || absoluteOffset + byteLength > buffer.byteLength) {
    throw new Error(`${label} reads outside bufferView ${bufferViewIndex}.`)
  }
}

function accessorElementByteSize(type: string, componentType: number): number {
  const componentBytes = componentSize(componentType)
  const components = componentCount(type)
  // glTF matrix columns containing 8- or 16-bit values are each aligned to a
  // 4-byte boundary. Vectors/scalars and 32-bit matrices are naturally packed.
  if (type === 'MAT2' || type === 'MAT3') {
    const dimension = type === 'MAT2' ? 2 : 3
    const columnBytes = dimension * componentBytes
    const alignedColumnBytes = Math.ceil(columnBytes / 4) * 4
    return alignedColumnBytes * dimension
  }
  return components * componentBytes
}

function accessorComponentByteOffset(type: string, componentType: number, componentIndex: number): number {
  const componentBytes = componentSize(componentType)
  if (type !== 'MAT2' && type !== 'MAT3') return componentIndex * componentBytes
  const dimension = type === 'MAT2' ? 2 : 3
  const column = Math.floor(componentIndex / dimension)
  const row = componentIndex % dimension
  const columnBytes = dimension * componentBytes
  const alignedColumnBytes = Math.ceil(columnBytes / 4) * 4
  return column * alignedColumnBytes + row * componentBytes
}

function parseGlb(buffer: ArrayBuffer): { document: GltfDocument; binary?: ArrayBuffer } {
  const view = new DataView(buffer)
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB header.')
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected 2.`)
  const declaredLength = view.getUint32(8, true)
  if (declaredLength > buffer.byteLength) throw new Error('GLB declared length exceeds the available data.')
  let offset = 12
  let document: GltfDocument | undefined
  let binary: ArrayBuffer | undefined
  while (offset + 8 <= declaredLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    const end = start + length
    if (end > declaredLength) throw new Error('GLB chunk exceeds the declared file length.')
    if (type === 0x4e4f534a) document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).replace(/[\0\s]+$/g, '')) as GltfDocument
    else if (type === 0x004e4942) binary = buffer.slice(start, end)
    offset = end
  }
  if (!document) throw new Error('GLB does not contain a JSON chunk.')
  return { document, binary }
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes
  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) return buffer
    return buffer.slice(byteOffset, byteOffset + byteLength)
  }
  const owned = new ArrayBuffer(byteLength)
  new Uint8Array(owned).set(bytes)
  return owned
}

function decodeDataUri(uri: string): { mimeType?: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(uri)
  if (!match) throw new Error('Malformed glTF data URI.')
  const mimeType = match[1]?.toLowerCase()
  const data = match[3] ?? ''
  if (match[2]) {
    if (typeof atob !== 'function') throw new Error('Base64 decoding is unavailable in this environment.')
    let text: string
    try { text = atob(data.replace(/\s/g, '')) }
    catch { throw new Error('Malformed base64 glTF data URI.') }
    const bytes = new Uint8Array(text.length)
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
    return { mimeType, bytes }
  }
  let decoded: string
  try { decoded = decodeURIComponent(data) }
  catch { throw new Error('Malformed URL-encoded glTF data URI.') }
  return { mimeType, bytes: new TextEncoder().encode(decoded) }
}

function validateDocument(document: GltfDocument): void {
  if (!document?.asset?.version?.startsWith('2.')) throw new Error(`Sekai64 supports glTF 2.x only; received ${document?.asset?.version ?? 'unknown'}.`)
}
function toTexCoord(value: number | undefined): 0 | 1 {
  if (value === undefined || value === 0) return 0
  if (value === 1) return 1
  throw gltfError('SEKAI_GLTF_UV_SET_MISSING', `Sekai64 currently supports TEXCOORD_0 and TEXCOORD_1; received TEXCOORD_${value}.`)
}
function componentCount(type: string): number { const map: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }; const count = map[type]; if (!count) throw new Error(`Unsupported glTF accessor type: ${type}`); return count }
function componentSize(type: number): number { if (type === 5120 || type === 5121) return 1; if (type === 5122 || type === 5123) return 2; if (type === 5125 || type === 5126) return 4; throw new Error(`Unsupported glTF component type: ${type}`) }
function readComponent(view: DataView, offset: number, type: number): number { if (type === 5120) return view.getInt8(offset); if (type === 5121) return view.getUint8(offset); if (type === 5122) return view.getInt16(offset, true); if (type === 5123) return view.getUint16(offset, true); if (type === 5125) return view.getUint32(offset, true); if (type === 5126) return view.getFloat32(offset, true); throw new Error(`Unsupported glTF component type: ${type}`) }
function normalizeComponent(value: number, type: number, normalized: boolean): number { if (!normalized) return value; if (type === 5120) return Math.max(value / 127, -1); if (type === 5121) return value / 255; if (type === 5122) return Math.max(value / 32767, -1); if (type === 5123) return value / 65535; return value }
function quaternionToEuler(rotation: readonly number[], target: Euler): void { const x=rotation[0]??0,y=rotation[1]??0,z=rotation[2]??0,w=rotation[3]??1; const sinr=2*(w*x+y*z), cosr=1-2*(x*x+y*y); const pitchX=Math.atan2(sinr,cosr); const sinp=2*(w*y-z*x); const yawY=Math.abs(sinp)>=1?Math.sign(sinp)*Math.PI/2:Math.asin(sinp); const siny=2*(w*z+x*y), cosy=1-2*(y*y+z*z); target.set(pitchX,yawY,Math.atan2(siny,cosy)) }
function decomposeMatrix(matrix: readonly number[], node: Node): void { node.position.set(matrix[12]??0,matrix[13]??0,matrix[14]??0); const sx=Math.hypot(matrix[0]??0,matrix[1]??0,matrix[2]??0); const sy=Math.hypot(matrix[4]??0,matrix[5]??0,matrix[6]??0); const sz=Math.hypot(matrix[8]??0,matrix[9]??0,matrix[10]??0); node.scale.set(sx,sy,sz); const m00=(matrix[0]??0)/sx,m01=(matrix[4]??0)/sy,m02=(matrix[8]??0)/sz,m12=(matrix[9]??0)/sz,m22=(matrix[10]??0)/sz; const y=Math.asin(Math.max(-1,Math.min(1,m02))); const x=Math.atan2(-m12,m22); const z=Math.atan2(-m01,m00); node.rotation.set(x,y,z) }
function forwardAbort(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) return () => undefined
  if (source.aborted) {
    target.abort(source.reason)
    return () => undefined
  }
  const abort = (): void => target.abort(source.reason)
  source.addEventListener('abort', abort, { once: true })
  return () => source.removeEventListener('abort', abort)
}

function gltfError(code: GltfDiagnosticCode, message: string): Error { const error = new Error(`${code}: ${message}`); error.name = code; return error }
function emitDiagnostic(context: GltfLoadContext, diagnostic: GltfDiagnostic): void {
  context.options.onDiagnostic?.(diagnostic)
  if (diagnostic.severity === 'error') throw gltfError(diagnostic.code, diagnostic.message)
}
