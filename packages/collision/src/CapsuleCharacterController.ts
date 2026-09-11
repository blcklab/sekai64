import { Box3, Vector3 } from '@sekai64-internal/math'
import { CollisionWorld, type StaticCollider } from './CollisionWorld.js'

export interface CapsuleCharacterControllerOptions {
  world: CollisionWorld
  radius?: number
  height?: number
  gravity?: number
  stepHeight?: number
  groundProbe?: number
  maxFallSpeed?: number
}

export interface CollisionResult {
  position: Vector3
  grounded: boolean
  collidedX: boolean
  collidedY: boolean
  collidedZ: boolean
  contacts: readonly StaticCollider[]
}

export class CapsuleCharacterController {
  readonly world: CollisionWorld
  radius: number
  height: number
  gravity: number
  stepHeight: number
  groundProbe: number
  maxFallSpeed: number
  verticalVelocity = 0
  grounded = false
  enabled = true
  private readonly resultPosition = new Vector3()
  private readonly bounds = new Box3()
  private readonly candidateBounds = new Box3()
  private readonly contacts = new Set<StaticCollider>()

  constructor(options: CapsuleCharacterControllerOptions) {
    this.world = options.world
    this.radius = Math.max(0.01, options.radius ?? 0.35)
    this.height = Math.max(this.radius * 2, options.height ?? 1.7)
    this.gravity = Math.max(0, options.gravity ?? 20)
    this.stepHeight = Math.max(0, options.stepHeight ?? 0.3)
    this.groundProbe = Math.max(0.001, options.groundProbe ?? 0.05)
    this.maxFallSpeed = Math.max(0, options.maxFallSpeed ?? 50)
  }

  move(position: Vector3, displacement: Vector3, deltaTime: number): Vector3 {
    return this.moveDetailed(position, displacement, deltaTime).position
  }

  moveDetailed(position: Vector3, displacement: Vector3, deltaTime: number): CollisionResult {
    if (!this.enabled) return { position: this.resultPosition.copy(position).add(displacement), grounded: false, collidedX: false, collidedY: false, collidedZ: false, contacts: [] }
    const dt = Math.max(0, Math.min(0.1, deltaTime))
    this.contacts.clear()
    this.resultPosition.copy(position)
    if (!this.grounded) this.verticalVelocity = Math.max(-this.maxFallSpeed, this.verticalVelocity - this.gravity * dt)
    else if (this.verticalVelocity < 0) this.verticalVelocity = 0

    let collidedX = false, collidedY = false, collidedZ = false
    const horizontal = new Vector3(displacement.x, 0, displacement.z)
    const maximumHorizontalStep = Math.max(0.05, this.radius * 0.5)
    const horizontalSteps = Math.max(1, Math.ceil(Math.max(Math.abs(horizontal.x), Math.abs(horizontal.z)) / maximumHorizontalStep))
    const step = new Vector3(horizontal.x / horizontalSteps, 0, horizontal.z / horizontalSteps)
    for (let index = 0; index < horizontalSteps; index += 1) {
      if (step.lengthSquared() > 0 && this.stepHeight > 0 && this.canStep(this.resultPosition, step)) this.resultPosition.y += this.stepHeight
      if (step.x !== 0) {
        this.resultPosition.x += step.x
        const correction = this.resolveAxis(this.resultPosition, 0, step.x)
        if (correction !== 0) { this.resultPosition.x += correction; collidedX = true }
      }
      if (step.z !== 0) {
        this.resultPosition.z += step.z
        const correction = this.resolveAxis(this.resultPosition, 2, step.z)
        if (correction !== 0) { this.resultPosition.z += correction; collidedZ = true }
      }
    }

    const verticalMove = displacement.y + this.verticalVelocity * dt
    this.resultPosition.y += verticalMove
    const yCorrection = this.resolveAxis(this.resultPosition, 1, verticalMove)
    if (yCorrection !== 0) {
      this.resultPosition.y += yCorrection
      collidedY = true
      if (verticalMove < 0) this.grounded = true
      this.verticalVelocity = 0
    } else {
      this.grounded = this.probeGround(this.resultPosition)
    }

    return { position: this.resultPosition.clone(), grounded: this.grounded, collidedX, collidedY, collidedZ, contacts: [...this.contacts] }
  }

  jump(speed = 7): boolean {
    if (!this.grounded) return false
    this.verticalVelocity = Math.max(0, speed)
    this.grounded = false
    return true
  }

  teleport(position: Vector3): void { this.resultPosition.copy(position); this.verticalVelocity = 0; this.grounded = false }

  private resolveAxis(position: Vector3, axis: number, movement: number): number {
    this.setCharacterBounds(position, this.bounds)
    let correction = 0
    for (const collider of this.world.query(this.bounds)) {
      if (!hasPositiveOverlapOnOtherAxes(this.bounds, collider.bounds, axis)) continue
      const candidate = axisCorrection(this.bounds, collider.bounds, axis, movement)
      if (candidate === 0) continue
      this.contacts.add(collider)
      correction = movement > 0 ? Math.min(correction, candidate) : Math.max(correction, candidate)
    }
    return correction
  }

  private canStep(position: Vector3, horizontal: Vector3): boolean {
    this.setCharacterBounds(position, this.bounds)
    this.candidateBounds.copy(this.bounds).translate(horizontal)
    const blocked = this.world.query(this.candidateBounds).some(collider => collider.bounds.intersectsBox(this.candidateBounds))
    if (!blocked) return false
    this.candidateBounds.translate(new Vector3(0, this.stepHeight, 0))
    return !this.world.query(this.candidateBounds).some(collider => collider.bounds.intersectsBox(this.candidateBounds))
  }

  private probeGround(position: Vector3): boolean {
    this.setCharacterBounds(position, this.bounds)
    this.bounds.min.y -= this.groundProbe
    return this.world.query(this.bounds).some(collider => collider.bounds.intersectsBox(this.bounds) && collider.bounds.max.y <= position.y - this.height + this.radius + this.groundProbe * 2)
  }

  private setCharacterBounds(position: Vector3, target: Box3): Box3 {
    return target.set(
      new Vector3(position.x - this.radius, position.y - this.height, position.z - this.radius),
      new Vector3(position.x + this.radius, position.y, position.z + this.radius)
    )
  }
}


function overlapAmount(minA: number, maxA: number, minB: number, maxB: number): number {
  return Math.min(maxA, maxB) - Math.max(minA, minB)
}

function hasPositiveOverlapOnOtherAxes(a: Box3, b: Box3, axis: number): boolean {
  const epsilon = 1e-7
  if (axis !== 0 && overlapAmount(a.min.x, a.max.x, b.min.x, b.max.x) <= epsilon) return false
  if (axis !== 1 && overlapAmount(a.min.y, a.max.y, b.min.y, b.max.y) <= epsilon) return false
  if (axis !== 2 && overlapAmount(a.min.z, a.max.z, b.min.z, b.max.z) <= epsilon) return false
  return true
}

function axisCorrection(a: Box3, b: Box3, axis: number, movement: number): number {
  const aMin = axis === 0 ? a.min.x : axis === 1 ? a.min.y : a.min.z
  const aMax = axis === 0 ? a.max.x : axis === 1 ? a.max.y : a.max.z
  const bMin = axis === 0 ? b.min.x : axis === 1 ? b.min.y : b.min.z
  const bMax = axis === 0 ? b.max.x : axis === 1 ? b.max.y : b.max.z
  if (movement > 0 && aMax > bMin && aMin < bMin) return bMin - aMax
  if (movement < 0 && aMin < bMax && aMax > bMax) return bMax - aMin
  return 0
}
