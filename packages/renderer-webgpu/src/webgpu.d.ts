type GPUTextureFormat = 'bgra8unorm' | 'rgba8unorm' | 'rgba8unorm-srgb' | 'depth24plus' | string
type GPUIndexFormat = 'uint16' | 'uint32'
type GPUBufferUsageFlags = number

// WebGPU queue uploads accept [AllowShared] BufferSource. Keep this local alias
// independent from DOM's narrower BufferSource so newer TypeScript versions do
// not reject typed arrays whose backing store is represented as ArrayBufferLike.
type Sekai64GPUAllowSharedBufferSource = ArrayBufferLike | ArrayBufferView<ArrayBufferLike>

declare const GPUShaderStage: { readonly VERTEX: number; readonly FRAGMENT: number; readonly COMPUTE: number }
declare const GPUBufferUsage: { readonly MAP_READ: number; readonly MAP_WRITE: number; readonly COPY_SRC: number; readonly COPY_DST: number; readonly INDEX: number; readonly VERTEX: number; readonly UNIFORM: number; readonly STORAGE: number; readonly INDIRECT: number; readonly QUERY_RESOLVE: number }
declare const GPUTextureUsage: { readonly COPY_SRC: number; readonly COPY_DST: number; readonly TEXTURE_BINDING: number; readonly STORAGE_BINDING: number; readonly RENDER_ATTACHMENT: number }

interface GPU {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>
  getPreferredCanvasFormat(): GPUTextureFormat
}

interface Navigator { readonly gpu: GPU }
interface GPUAdapter { readonly limits: { readonly maxTextureDimension2D: number }; requestDevice(): Promise<GPUDevice> }
interface GPUDeviceLostInfo { readonly reason: string; readonly message: string }
interface GPUDevice {
  readonly queue: GPUQueue
  readonly features: ReadonlySet<string>
  readonly lost: Promise<GPUDeviceLostInfo>
  createBindGroupLayout(descriptor: object): GPUBindGroupLayout
  createPipelineLayout(descriptor: object): GPUPipelineLayout
  createTexture(descriptor: object): GPUTexture
  createCommandEncoder(descriptor?: object): GPUCommandEncoder
  createBuffer(descriptor: { label?: string; size: number; usage: number; mappedAtCreation?: boolean }): GPUBuffer
  createBindGroup(descriptor: object): GPUBindGroup
  createShaderModule(descriptor: object): GPUShaderModule
  createRenderPipeline(descriptor: object): GPURenderPipeline
  createSampler(descriptor?: object): GPUSampler
  destroy(): void
}
interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: Sekai64GPUAllowSharedBufferSource): void
  writeTexture(destination: object, data: Sekai64GPUAllowSharedBufferSource, dataLayout: object, size: readonly number[]): void
  copyExternalImageToTexture(source: object, destination: object, copySize: readonly number[]): void
  submit(commandBuffers: readonly GPUCommandBuffer[]): void
}
interface GPUCanvasContext { configure(configuration: object): void; getCurrentTexture(): GPUTexture }
interface GPUTexture { createView(descriptor?: object): GPUTextureView; destroy(): void }
interface GPUTextureView {}
interface GPUSampler {}
interface GPUBuffer { getMappedRange(): ArrayBuffer; unmap(): void; destroy(): void }
interface GPUBindGroupLayout {}
interface GPUPipelineLayout {}
interface GPUBindGroup {}
interface GPUShaderModule {}
interface GPURenderPipeline {}
interface GPUCommandBuffer {}
interface GPUCommandEncoder { beginRenderPass(descriptor: object): GPURenderPassEncoder; finish(descriptor?: object): GPUCommandBuffer }
interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void
  setBindGroup(index: number, bindGroup: GPUBindGroup): void
  setVertexBuffer(slot: number, buffer: GPUBuffer): void
  setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat): void
  draw(vertexCount: number, instanceCount?: number): void
  drawIndexed(indexCount: number, instanceCount?: number): void
  end(): void
}

declare const GPUMapMode: { readonly READ: number; readonly WRITE: number }
interface GPUQuerySet { destroy(): void }
interface GPUAdapter {
  readonly features: ReadonlySet<string>
  requestDevice(descriptor?: { requiredFeatures?: readonly string[] }): Promise<GPUDevice>
}
interface GPUDevice {
  createQuerySet(descriptor: { type: 'timestamp'; count: number; label?: string }): GPUQuerySet
}
interface GPUQueue { onSubmittedWorkDone(): Promise<void> }
interface GPUBuffer { mapAsync(mode: number, offset?: number, size?: number): Promise<void> }
interface GPUCommandEncoder {
  writeTimestamp?(querySet: GPUQuerySet, queryIndex: number): void
  resolveQuerySet(querySet: GPUQuerySet, firstQuery: number, queryCount: number, destination: GPUBuffer, destinationOffset: number): void
  copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void
}
