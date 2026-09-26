import type { Geometry } from '@sekai64-internal/geometry'
import type { Material } from '@sekai64-internal/materials'
import { Matrix4, Vector3 } from '@sekai64-internal/math'
import { InstancedMesh, type InstancedMeshOptions } from './InstancedMesh.js'

export type ParticleSimulationSpace = 'local' | 'world'
export type ParticleQuality = 'low' | 'balanced' | 'high' | 'ultra'
export type ParticleSpawnShape =
  | { type: 'point' }
  | { type: 'box'; size: readonly [number, number, number] }
  | { type: 'sphere'; radius: number }
  | { type: 'surface'; size?: readonly [number, number, number] }

export interface ParticleScalarRange { min: number; max: number }
export interface ParticleScalarCurve { start: number; end: number }
export interface ParticleColorCurve {
  start: readonly [number, number, number]
  end: readonly [number, number, number]
}
export interface ParticleVectorRange {
  min: readonly [number, number, number]
  max: readonly [number, number, number]
}

export interface ParticleEmitterOptions extends Omit<InstancedMeshOptions, 'count' | 'matrices' | 'geometry' | 'material' | 'materials'> {
  geometry: Geometry
  material: Material
  seed?: number
  maxParticles: number
  emissionRate?: number
  burst?: number
  lifetime?: ParticleScalarRange
  spawnShape?: ParticleSpawnShape
  velocity?: ParticleVectorRange
  acceleration?: readonly [number, number, number]
  gravity?: readonly [number, number, number]
  drag?: number
  size?: ParticleScalarRange
  opacity?: ParticleScalarRange
  rotation?: ParticleScalarRange
  sizeOverLife?: ParticleScalarCurve
  opacityOverLife?: ParticleScalarCurve
  rotationOverLife?: ParticleScalarCurve
  colorOverLife?: ParticleColorCurve
  importance?: number
  space?: ParticleSimulationSpace
  quality?: ParticleQuality
  autoplay?: boolean
  loop?: boolean
}

export interface ParticleEmitterStats {
  readonly activeParticles: number
  readonly budgetParticles: number
  readonly capacity: number
  readonly emittedParticles: number
  readonly playing: boolean
}

export interface ParticleBillboardCamera {
  readonly worldMatrix: Matrix4
  updateWorldFromRoot(): void
}

const QUALITY_SCALE: Readonly<Record<ParticleQuality, number>> = Object.freeze({
  low: 0.35,
  balanced: 0.65,
  high: 0.85,
  ultra: 1,
})
const PARTICLE_LOD_RANGES: Readonly<Record<ParticleQuality, Readonly<{ near: number; medium: number; far: number; cull: number }>>> = Object.freeze({
  low: Object.freeze({ near: 12, medium: 45, far: 90, cull: 130 }),
  balanced: Object.freeze({ near: 20, medium: 75, far: 150, cull: 220 }),
  high: Object.freeze({ near: 30, medium: 110, far: 220, cull: 320 }),
  ultra: Object.freeze({ near: 40, medium: 150, far: 300, cull: 450 }),
})

/**
 * Generic deterministic sprite-particle emitter backed by one instanced mesh.
 *
 * Particle state lives in compact typed arrays and active particles are kept in
 * a dense prefix so both WebGL2 and WebGPU draw only the currently active budget.
 * The existing instanced rendering path remains the backend implementation.
 */
export class ParticleEmitter extends InstancedMesh {
  readonly seed: number
  readonly maxParticles: number
  readonly positions: Float32Array
  readonly velocities: Float32Array
  readonly ages: Float32Array
  readonly lifetimes: Float32Array
  readonly particleSizes: Float32Array
  readonly opacities: Float32Array
  readonly rotations: Float32Array

  readonly emissionRate: number
  readonly burst: number
  readonly lifetime: ParticleScalarRange
  readonly spawnShape: ParticleSpawnShape
  readonly velocity: ParticleVectorRange
  readonly acceleration: readonly [number, number, number]
  readonly gravity: readonly [number, number, number]
  readonly drag: number
  readonly sizeRange: ParticleScalarRange
  readonly opacityRange: ParticleScalarRange
  readonly rotationRange: ParticleScalarRange
  readonly sizeOverLife?: ParticleScalarCurve
  readonly opacityOverLife?: ParticleScalarCurve
  readonly rotationOverLife?: ParticleScalarCurve
  readonly colorOverLife?: ParticleColorCurve
  readonly importance: number
  readonly space: ParticleSimulationSpace
  readonly loop: boolean

  private qualityValue: ParticleQuality
  private playingValue: boolean
  private activeParticlesValue = 0
  private emittedParticlesValue = 0
  private emissionAccumulator = 0
  private burstPending = 0
  private randomState: number
  private distanceBudgetScale = 1
  private distanceOpacityScale = 1
  private readonly emitterInverse = new Matrix4()
  private readonly billboardWorld = new Matrix4()
  private readonly billboardLocal = new Matrix4()
  private readonly spawnPoint = new Vector3()
  private readonly worldPoint = new Vector3()

  constructor(options: ParticleEmitterOptions) {
    const maxParticles = integerAtLeast(options.maxParticles, 1, 'maxParticles')
    super({
      ...options,
      geometry: options.geometry,
      material: options.material,
      count: maxParticles,
      ownsResources: options.ownsResources ?? false,
      castShadow: options.castShadow ?? false,
      receiveShadow: options.receiveShadow ?? false,
    })
    this.seed = normalizeSeed(options.seed ?? 0)
    this.maxParticles = maxParticles
    this.emissionRate = finiteAtLeast(options.emissionRate ?? 0, 0, 'emissionRate')
    this.burst = finiteAtLeast(options.burst ?? 0, 0, 'burst')
    this.lifetime = normalizeScalarRange(options.lifetime, 1, 1, 'lifetime', 0.000001)
    this.spawnShape = normalizeSpawnShape(options.spawnShape)
    this.velocity = normalizeVectorRange(options.velocity)
    this.acceleration = finiteVector(options.acceleration ?? [0, 0, 0], 'acceleration')
    this.gravity = finiteVector(options.gravity ?? [0, 0, 0], 'gravity')
    this.drag = finiteAtLeast(options.drag ?? 0, 0, 'drag')
    this.sizeRange = normalizeScalarRange(options.size, 0.1, 0.1, 'size', 0)
    this.opacityRange = normalizeScalarRange(options.opacity, 1, 1, 'opacity', 0, 1)
    this.rotationRange = normalizeScalarRange(options.rotation, 0, 0, 'rotation')
    this.sizeOverLife = normalizeCurve(options.sizeOverLife, 'sizeOverLife', 0)
    this.opacityOverLife = normalizeCurve(options.opacityOverLife, 'opacityOverLife', 0, 1)
    this.rotationOverLife = normalizeCurve(options.rotationOverLife, 'rotationOverLife')
    this.colorOverLife = normalizeColorCurve(options.colorOverLife)
    this.importance = clampFinite(options.importance ?? 1, 0, 1, 'importance')
    this.space = options.space === 'world' ? 'world' : 'local'
    this.qualityValue = options.quality ?? 'balanced'
    this.loop = options.loop ?? true
    this.playingValue = options.autoplay ?? true

    this.positions = new Float32Array(maxParticles * 3)
    this.velocities = new Float32Array(maxParticles * 3)
    this.ages = new Float32Array(maxParticles)
    this.lifetimes = new Float32Array(maxParticles)
    this.particleSizes = new Float32Array(maxParticles)
    this.opacities = new Float32Array(maxParticles)
    this.rotations = new Float32Array(maxParticles)
    this.randomState = this.seed || 0x6d2b79f5
    this.reset()
  }

  get quality(): ParticleQuality { return this.qualityValue }
  set quality(value: ParticleQuality) {
    if (!(value in QUALITY_SCALE)) throw new Error(`Unsupported particle quality: ${value}`)
    if (this.qualityValue === value) return
    this.qualityValue = value
    this.enforceBudget()
  }

  get budgetParticles(): number {
    const qualityScale = QUALITY_SCALE[this.qualityValue]
    const importanceScale = 0.35 + this.importance * 0.65
    return Math.max(0, Math.min(this.maxParticles, Math.floor(this.maxParticles * qualityScale * importanceScale * this.distanceBudgetScale)))
  }

  get activeParticles(): number { return this.activeParticlesValue }
  get playing(): boolean { return this.playingValue }
  get stats(): ParticleEmitterStats {
    return Object.freeze({
      activeParticles: this.activeParticlesValue,
      budgetParticles: this.budgetParticles,
      capacity: this.maxParticles,
      emittedParticles: this.emittedParticlesValue,
      playing: this.playingValue,
    })
  }

  play(): this {
    if (!this.playingValue && this.emittedParticlesValue === 0 && this.activeParticlesValue === 0) this.burstPending = Math.floor(this.burst)
    this.playingValue = true
    return this
  }
  pause(): this { this.playingValue = false; return this }

  reset(): this {
    this.activeParticlesValue = 0
    this.emittedParticlesValue = 0
    this.emissionAccumulator = 0
    this.burstPending = this.playingValue ? Math.floor(this.burst) : 0
    this.randomState = this.seed || 0x6d2b79f5
    this.positions.fill(0)
    this.velocities.fill(0)
    this.ages.fill(0)
    this.lifetimes.fill(0)
    this.particleSizes.fill(0)
    this.opacities.fill(0)
    this.rotations.fill(0)
    this.setDrawCount(0)
    return this
  }

  /** Advances simulation and rebuilds billboard instance matrices for one frame. */
  update(deltaTime: number, camera: ParticleBillboardCamera): this {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) throw new Error('ParticleEmitter deltaTime must be a non-negative finite number.')
    const dt = Math.min(deltaTime, 0.25)
    this.updateWorldFromRoot()
    camera.updateWorldFromRoot()
    this.updateDistanceBudget(camera)

    this.simulate(dt)
    if (this.playingValue) this.emitParticles(dt)
    this.enforceBudget()
    this.rebuildBillboards(camera)
    this.setDrawCount(this.activeParticlesValue)
    return this
  }

  private simulate(dt: number): void {
    const forceX = this.acceleration[0] + this.gravity[0]
    const forceY = this.acceleration[1] + this.gravity[1]
    const forceZ = this.acceleration[2] + this.gravity[2]
    const damping = this.drag > 0 ? 1 / (1 + this.drag * dt) : 1
    let index = 0
    while (index < this.activeParticlesValue) {
      const age = (this.ages[index] ?? 0) + dt
      const lifetime = this.lifetimes[index] ?? 0
      if (age >= lifetime) {
        this.removeParticle(index)
        continue
      }
      this.ages[index] = age
      const base = index * 3
      const vx = ((this.velocities[base] ?? 0) + forceX * dt) * damping
      const vy = ((this.velocities[base + 1] ?? 0) + forceY * dt) * damping
      const vz = ((this.velocities[base + 2] ?? 0) + forceZ * dt) * damping
      this.velocities[base] = vx
      this.velocities[base + 1] = vy
      this.velocities[base + 2] = vz
      this.positions[base] = (this.positions[base] ?? 0) + vx * dt
      this.positions[base + 1] = (this.positions[base + 1] ?? 0) + vy * dt
      this.positions[base + 2] = (this.positions[base + 2] ?? 0) + vz * dt
      index += 1
    }
  }

  private emitParticles(dt: number): void {
    const budget = this.budgetParticles
    if (this.burstPending > 0) {
      const count = Math.min(this.burstPending, budget - this.activeParticlesValue)
      for (let index = 0; index < count; index += 1) this.spawnParticle()
      this.burstPending -= count
    }
    if (this.emissionRate <= 0 || this.activeParticlesValue >= budget) return
    if (!this.loop && this.emittedParticlesValue >= this.maxParticles) return
    this.emissionAccumulator += this.emissionRate * dt
    let count = Math.floor(this.emissionAccumulator)
    if (count <= 0) return
    this.emissionAccumulator -= count
    count = Math.min(count, budget - this.activeParticlesValue)
    if (!this.loop) count = Math.min(count, this.maxParticles - this.emittedParticlesValue)
    for (let index = 0; index < count; index += 1) this.spawnParticle()
  }

  private spawnParticle(): void {
    if (this.activeParticlesValue >= this.budgetParticles || this.activeParticlesValue >= this.maxParticles) return
    const index = this.activeParticlesValue++
    const base = index * 3
    this.sampleSpawnPoint(this.spawnPoint)
    if (this.space === 'world') {
      this.worldPoint.copy(this.spawnPoint).applyMatrix4(this.worldMatrix)
      this.positions[base] = this.worldPoint.x
      this.positions[base + 1] = this.worldPoint.y
      this.positions[base + 2] = this.worldPoint.z
    } else {
      this.positions[base] = this.spawnPoint.x
      this.positions[base + 1] = this.spawnPoint.y
      this.positions[base + 2] = this.spawnPoint.z
    }
    this.velocities[base] = this.randomBetween(this.velocity.min[0], this.velocity.max[0])
    this.velocities[base + 1] = this.randomBetween(this.velocity.min[1], this.velocity.max[1])
    this.velocities[base + 2] = this.randomBetween(this.velocity.min[2], this.velocity.max[2])
    this.ages[index] = 0
    this.lifetimes[index] = this.randomBetween(this.lifetime.min, this.lifetime.max)
    this.particleSizes[index] = this.randomBetween(this.sizeRange.min, this.sizeRange.max)
    this.opacities[index] = this.randomBetween(this.opacityRange.min, this.opacityRange.max)
    this.rotations[index] = this.randomBetween(this.rotationRange.min, this.rotationRange.max)
    this.emittedParticlesValue += 1
  }

  private sampleSpawnPoint(target: Vector3): void {
    const shape = this.spawnShape
    if (shape.type === 'point') { target.set(0, 0, 0); return }
    if (shape.type === 'box') {
      target.set(
        (this.random() - 0.5) * shape.size[0],
        (this.random() - 0.5) * shape.size[1],
        (this.random() - 0.5) * shape.size[2],
      )
      return
    }
    if (shape.type === 'surface') {
      const size = shape.size ?? [1, 1, 1]
      target.set((this.random() - 0.5) * size[0], 0, (this.random() - 0.5) * size[2])
      return
    }
    const y = this.random() * 2 - 1
    const angle = this.random() * Math.PI * 2
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const radius = Math.cbrt(this.random()) * shape.radius
    target.set(Math.cos(angle) * radial * radius, y * radius, Math.sin(angle) * radial * radius)
  }

  private rebuildBillboards(camera: ParticleBillboardCamera): void {
    const cameraElements = camera.worldMatrix.elements
    const rx = cameraElements[0] ?? 1, ry = cameraElements[1] ?? 0, rz = cameraElements[2] ?? 0
    const ux = cameraElements[4] ?? 0, uy = cameraElements[5] ?? 1, uz = cameraElements[6] ?? 0
    const fx = cameraElements[8] ?? 0, fy = cameraElements[9] ?? 0, fz = cameraElements[10] ?? 1
    this.emitterInverse.copy(this.worldMatrix).invert()

    for (let index = 0; index < this.activeParticlesValue; index += 1) {
      const base = index * 3
      if (this.space === 'local') {
        this.worldPoint.set(this.positions[base] ?? 0, this.positions[base + 1] ?? 0, this.positions[base + 2] ?? 0).applyMatrix4(this.worldMatrix)
      } else {
        this.worldPoint.set(this.positions[base] ?? 0, this.positions[base + 1] ?? 0, this.positions[base + 2] ?? 0)
      }
      const lifetime = Math.max(this.lifetimes[index] ?? 1, 0.000001)
      const normalizedAge = Math.min(1, Math.max(0, (this.ages[index] ?? 0) / lifetime))
      const size = this.sizeOverLife ? sampleCurve(this.sizeOverLife, normalizedAge) : (this.particleSizes[index] ?? 0)
      const rotation = this.rotationOverLife ? sampleCurve(this.rotationOverLife, normalizedAge) : (this.rotations[index] ?? 0)
      const opacity = (this.opacityOverLife ? sampleCurve(this.opacityOverLife, normalizedAge) : (this.opacities[index] ?? 1)) * this.distanceOpacityScale
      const colorOffset = index * 4
      if (this.colorOverLife) {
        this.instanceColors[colorOffset] = lerp(this.colorOverLife.start[0], this.colorOverLife.end[0], normalizedAge)
        this.instanceColors[colorOffset + 1] = lerp(this.colorOverLife.start[1], this.colorOverLife.end[1], normalizedAge)
        this.instanceColors[colorOffset + 2] = lerp(this.colorOverLife.start[2], this.colorOverLife.end[2], normalizedAge)
      } else {
        this.instanceColors[colorOffset] = 1
        this.instanceColors[colorOffset + 1] = 1
        this.instanceColors[colorOffset + 2] = 1
      }
      this.instanceColors[colorOffset + 3] = opacity
      const c = Math.cos(rotation), s = Math.sin(rotation)
      const rightX = (rx * c + ux * s) * size
      const rightY = (ry * c + uy * s) * size
      const rightZ = (rz * c + uz * s) * size
      const upX = (-rx * s + ux * c) * size
      const upY = (-ry * s + uy * c) * size
      const upZ = (-rz * s + uz * c) * size
      this.billboardWorld.set(
        rightX, rightY, rightZ, 0,
        upX, upY, upZ, 0,
        fx, fy, fz, 0,
        this.worldPoint.x, this.worldPoint.y, this.worldPoint.z, 1,
      )
      this.billboardLocal.multiplyMatrices(this.emitterInverse, this.billboardWorld)
      this.setMatrixAt(index, this.billboardLocal)
    }
    this.markInstanceColorsDirty()
  }

  private updateDistanceBudget(camera: ParticleBillboardCamera): void {
    const cameraElements = camera.worldMatrix.elements
    const emitterElements = this.worldMatrix.elements
    const dx = (cameraElements[12] ?? 0) - (emitterElements[12] ?? 0)
    const dy = (cameraElements[13] ?? 0) - (emitterElements[13] ?? 0)
    const dz = (cameraElements[14] ?? 0) - (emitterElements[14] ?? 0)
    const distance = Math.hypot(dx, dy, dz)
    const ranges = PARTICLE_LOD_RANGES[this.qualityValue]
    if (distance <= ranges.near) { this.distanceBudgetScale = 1; this.distanceOpacityScale = 1; return }
    if (distance <= ranges.medium) {
      const t = inverseLerp(ranges.near, ranges.medium, distance)
      this.distanceBudgetScale = lerp(1, 0.65, t)
      this.distanceOpacityScale = 1
      return
    }
    if (distance <= ranges.far) {
      const t = inverseLerp(ranges.medium, ranges.far, distance)
      this.distanceBudgetScale = lerp(0.65, 0.15, t)
      this.distanceOpacityScale = lerp(1, 0.55, t)
      return
    }
    if (distance <= ranges.cull) {
      const t = inverseLerp(ranges.far, ranges.cull, distance)
      this.distanceBudgetScale = lerp(0.15, 0, t)
      this.distanceOpacityScale = lerp(0.55, 0, t)
      return
    }
    this.distanceBudgetScale = 0
    this.distanceOpacityScale = 0
  }

  private enforceBudget(): void {
    const budget = this.budgetParticles
    while (this.activeParticlesValue > budget) this.removeParticle(this.activeParticlesValue - 1)
    this.setDrawCount(this.activeParticlesValue)
  }

  private removeParticle(index: number): void {
    const last = this.activeParticlesValue - 1
    if (index < 0 || index > last) return
    if (index !== last) {
      copyTriplet(this.positions, last, index)
      copyTriplet(this.velocities, last, index)
      this.ages[index] = this.ages[last] ?? 0
      this.lifetimes[index] = this.lifetimes[last] ?? 0
      this.particleSizes[index] = this.particleSizes[last] ?? 0
      this.opacities[index] = this.opacities[last] ?? 0
      this.rotations[index] = this.rotations[last] ?? 0
      copyQuad(this.instanceColors, last, index)
    }
    this.activeParticlesValue = Math.max(0, last)
  }

  private random(): number {
    let state = this.randomState >>> 0
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    this.randomState = state >>> 0
    return (this.randomState >>> 0) / 0x100000000
  }

  private randomBetween(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.random()
  }
}

function normalizeSeed(value: number): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 0xffffffff) throw new Error('ParticleEmitter seed must be a safe 32-bit integer.')
  return value >>> 0
}

function normalizeSpawnShape(value: ParticleSpawnShape | undefined): ParticleSpawnShape {
  if (!value || value.type === 'point') return Object.freeze({ type: 'point' })
  if (value.type === 'sphere') return Object.freeze({ type: 'sphere', radius: finiteAtLeast(value.radius, 0.000001, 'spawnShape.radius') })
  if (value.type === 'box') return Object.freeze({ type: 'box', size: finitePositiveVector(value.size, 'spawnShape.size') })
  if (value.type === 'surface') return Object.freeze({ type: 'surface', ...(value.size ? { size: finitePositiveVector(value.size, 'spawnShape.size') } : {}) })
  throw new Error('Unsupported particle spawn shape.')
}

function normalizeVectorRange(value: ParticleVectorRange | undefined): ParticleVectorRange {
  const min = finiteVector(value?.min ?? [0, 0, 0], 'velocity.min')
  const max = finiteVector(value?.max ?? min, 'velocity.max')
  for (let axis = 0; axis < 3; axis += 1) if ((max[axis] ?? 0) < (min[axis] ?? 0)) throw new Error('ParticleEmitter velocity.max must be greater than or equal to velocity.min on every axis.')
  return Object.freeze({ min, max })
}


function normalizeCurve(value: ParticleScalarCurve | undefined, label: string, minimum = -Infinity, maximum = Infinity): ParticleScalarCurve | undefined {
  if (!value) return undefined
  return Object.freeze({
    start: clampFinite(value.start, minimum, maximum, `${label}.start`),
    end: clampFinite(value.end, minimum, maximum, `${label}.end`),
  })
}

function normalizeColorCurve(value: ParticleColorCurve | undefined): ParticleColorCurve | undefined {
  if (!value) return undefined
  return Object.freeze({ start: finiteUnitColor(value.start, 'colorOverLife.start'), end: finiteUnitColor(value.end, 'colorOverLife.end') })
}

function finiteUnitColor(value: readonly [number, number, number], label: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isFinite(item) || item < 0 || item > 1)) throw new Error(`ParticleEmitter ${label} must contain three finite numbers from 0 to 1.`)
  return Object.freeze([value[0], value[1], value[2]] as const)
}

function sampleCurve(curve: ParticleScalarCurve, t: number): number { return lerp(curve.start, curve.end, t) }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function inverseLerp(a: number, b: number, value: number): number { return b === a ? 0 : Math.min(1, Math.max(0, (value - a) / (b - a))) }

function normalizeScalarRange(value: ParticleScalarRange | undefined, defaultMin: number, defaultMax: number, label: string, minimum = -Infinity, maximum = Infinity): ParticleScalarRange {
  const min = clampFinite(value?.min ?? defaultMin, minimum, maximum, `${label}.min`)
  const max = clampFinite(value?.max ?? defaultMax, minimum, maximum, `${label}.max`)
  if (max < min) throw new Error(`ParticleEmitter ${label}.max must be greater than or equal to ${label}.min.`)
  return Object.freeze({ min, max })
}

function finiteVector(value: readonly [number, number, number], label: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isFinite(item))) throw new Error(`ParticleEmitter ${label} must contain three finite numbers.`)
  return Object.freeze([value[0], value[1], value[2]] as const)
}

function finitePositiveVector(value: readonly [number, number, number], label: string): readonly [number, number, number] {
  const vector = finiteVector(value, label)
  if (vector.some(item => item <= 0)) throw new Error(`ParticleEmitter ${label} values must be greater than zero.`)
  return vector
}

function finiteAtLeast(value: number, minimum: number, label: string): number {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`ParticleEmitter ${label} must be a finite number greater than or equal to ${minimum}.`)
  return value
}

function clampFinite(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`ParticleEmitter ${label} must be finite.`)
  return Math.max(minimum, Math.min(maximum, value))
}

function integerAtLeast(value: number, minimum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`ParticleEmitter ${label} must be an integer greater than or equal to ${minimum}.`)
  return value
}

function copyTriplet(array: Float32Array, sourceIndex: number, targetIndex: number): void {
  const source = sourceIndex * 3, target = targetIndex * 3
  array[target] = array[source] ?? 0
  array[target + 1] = array[source + 1] ?? 0
  array[target + 2] = array[source + 2] ?? 0
}

function copyQuad(values: Float32Array, source: number, target: number): void {
  const sourceOffset = source * 4, targetOffset = target * 4
  values[targetOffset] = values[sourceOffset] ?? 1
  values[targetOffset + 1] = values[sourceOffset + 1] ?? 1
  values[targetOffset + 2] = values[sourceOffset + 2] ?? 1
  values[targetOffset + 3] = values[sourceOffset + 3] ?? 1
}
