import type { RendererStats } from './Renderer.js'

export type RendererProfilePhase = 'transform' | 'queue' | 'lights' | 'shadows' | 'main' | 'postprocess' | 'residency'

export interface RendererFrameProfile {
  frame: number
  timestamp: number
  cpuFrameMs: number
  gpuFrameMs: number | null
  fps: number
  phases: Readonly<Record<RendererProfilePhase, number>>
  drawCalls: number
  instancedDrawCalls: number
  instancesRendered: number
  triangles: number
  visibleObjects: number
  culledObjects: number
  frustumCulledObjects: number
  occlusionCulledObjects: number
  shadowDrawCalls: number
  postProcessPasses: number
  visibleLights: number
  rejectedLights: number
  clusterOverflows: number
  pipelineChanges: number
  materialChanges: number
  uniformUpdates: number
  bindGroupChanges: number
  geometryUploads: number
  geometryEvictions: number
  textureUploads: number
  textureEvictions: number
  gpuResourceCreationsThisFrame: number
  renderItemAllocations: number
  renderItemPoolSize: number
  textureMemory: number
  geometryMemory: number
  lodLevelCounts: readonly number[]
}

export interface RendererPerformanceSummary {
  frames: number
  averageCpuFrameMs: number
  p95CpuFrameMs: number
  averageGpuFrameMs: number | null
  p95GpuFrameMs: number | null
  averageFps: number
  averageDrawCalls: number
  averageTriangles: number
  latest?: RendererFrameProfile
}

/** Allocation-bounded rolling renderer profiler suitable for HUDs and diagnostics. */
export class RendererPerformanceProfiler {
  private readonly frames: RendererFrameProfile[]
  private cursor = 0
  private count = 0
  private frameNumber = 0
  private readonly phaseStarts = new Map<RendererProfilePhase, number>()
  private readonly phaseValues: Record<RendererProfilePhase, number> = {
    transform: 0,
    queue: 0,
    lights: 0,
    shadows: 0,
    main: 0,
    postprocess: 0,
    residency: 0,
  }

  constructor(readonly capacity = 240) {
    this.frames = new Array(Math.max(1, Math.floor(capacity)))
  }

  beginFrame(): void {
    this.frameNumber += 1
    for (const phase of Object.keys(this.phaseValues) as RendererProfilePhase[]) this.phaseValues[phase] = 0
    this.phaseStarts.clear()
  }

  beginPhase(phase: RendererProfilePhase): void { this.phaseStarts.set(phase, now()) }

  endPhase(phase: RendererProfilePhase): number {
    const started = this.phaseStarts.get(phase)
    if (started === undefined) return 0
    const elapsed = Math.max(0, now() - started)
    this.phaseStarts.delete(phase)
    this.phaseValues[phase] += elapsed
    return elapsed
  }

  record(stats: RendererStats): RendererFrameProfile {
    const profile: RendererFrameProfile = Object.freeze({
      frame: this.frameNumber,
      timestamp: Date.now(),
      cpuFrameMs: stats.cpuFrameMs,
      gpuFrameMs: stats.gpuFrameMs,
      fps: stats.fps,
      phases: Object.freeze({ ...this.phaseValues }),
      drawCalls: stats.drawCalls,
      instancedDrawCalls: stats.instancedDrawCalls,
      instancesRendered: stats.instancesRendered,
      triangles: stats.triangles,
      visibleObjects: stats.visibleObjects,
      culledObjects: stats.culledObjects,
      frustumCulledObjects: stats.frustumCulledObjects,
      occlusionCulledObjects: stats.occlusionCulledObjects,
      shadowDrawCalls: stats.shadowDrawCalls,
      postProcessPasses: stats.postProcessPasses,
      visibleLights: stats.visibleLights,
      rejectedLights: stats.rejectedLights,
      clusterOverflows: stats.clusterOverflows,
      pipelineChanges: stats.pipelineChanges,
      materialChanges: stats.materialChanges,
      uniformUpdates: stats.uniformUpdates,
      bindGroupChanges: stats.bindGroupChanges,
      geometryUploads: stats.geometryUploads,
      geometryEvictions: stats.geometryEvictions,
      textureUploads: stats.textureUploads,
      textureEvictions: stats.textureEvictions,
      gpuResourceCreationsThisFrame: stats.gpuResourceCreationsThisFrame,
      renderItemAllocations: stats.renderItemAllocations,
      renderItemPoolSize: stats.renderItemPoolSize,
      textureMemory: stats.textureMemory,
      geometryMemory: stats.geometryMemory,
      lodLevelCounts: Object.freeze([...stats.lodLevelCounts]),
    })
    this.frames[this.cursor] = profile
    this.cursor = (this.cursor + 1) % this.frames.length
    this.count = Math.min(this.frames.length, this.count + 1)
    return profile
  }

  summary(): RendererPerformanceSummary {
    const frames = this.orderedFrames()
    if (frames.length === 0) return { frames: 0, averageCpuFrameMs: 0, p95CpuFrameMs: 0, averageGpuFrameMs: null, p95GpuFrameMs: null, averageFps: 0, averageDrawCalls: 0, averageTriangles: 0 }
    const cpu = frames.map(frame => frame.cpuFrameMs).sort((a, b) => a - b)
    const gpu = frames.map(frame => frame.gpuFrameMs).filter((value): value is number => value !== null).sort((a, b) => a - b)
    return {
      frames: frames.length,
      averageCpuFrameMs: average(cpu),
      p95CpuFrameMs: percentile(cpu, 0.95),
      averageGpuFrameMs: gpu.length ? average(gpu) : null,
      p95GpuFrameMs: gpu.length ? percentile(gpu, 0.95) : null,
      averageFps: average(frames.map(frame => frame.fps)),
      averageDrawCalls: average(frames.map(frame => frame.drawCalls)),
      averageTriangles: average(frames.map(frame => frame.triangles)),
      latest: frames[frames.length - 1],
    }
  }

  exportFrames(): readonly RendererFrameProfile[] { return Object.freeze(this.orderedFrames()) }
  toJSON(): Readonly<{ summary: RendererPerformanceSummary; frames: readonly RendererFrameProfile[] }> {
    return Object.freeze({ summary: this.summary(), frames: this.exportFrames() })
  }
  clear(): void { this.cursor = 0; this.count = 0; this.frameNumber = 0; this.phaseStarts.clear() }

  private orderedFrames(): RendererFrameProfile[] {
    const output: RendererFrameProfile[] = []
    const start = this.count === this.frames.length ? this.cursor : 0
    for (let index = 0; index < this.count; index += 1) {
      const frame = this.frames[(start + index) % this.frames.length]
      if (frame) output.push(frame)
    }
    return output
  }
}

function average(values: readonly number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function percentile(values: readonly number[], ratio: number): number { return values.length ? values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))] ?? 0 : 0 }
function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now() }
