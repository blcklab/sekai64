import { ManagedResource } from '@sekai64-internal/core'
import { Matrix4 } from '@sekai64-internal/math'
import type { Node } from '@sekai64-internal/scene'

export interface SkeletonResourceOptions {
  id: string
  joints: readonly Node[]
  inverseBindMatrices?: Float32Array
  label?: string
}

export class SkeletonResource extends ManagedResource {
  readonly id: string
  readonly joints: readonly Node[]
  readonly inverseBindMatrices: Float32Array
  readonly palette: Float32Array
  version = 0
  private readonly inverse = new Matrix4()
  private readonly combined = new Matrix4()

  constructor(options: SkeletonResourceOptions) {
    super(options.label ?? options.id)
    if (!options.id.trim()) throw new Error('Skeleton id cannot be empty.')
    if (options.joints.length === 0) throw new Error('Skeleton requires at least one joint.')
    const expected = options.joints.length * 16
    if (options.inverseBindMatrices && options.inverseBindMatrices.length !== expected) {
      throw new Error(`Skeleton inverse bind matrix length must be ${expected}; received ${options.inverseBindMatrices.length}.`)
    }
    this.id = options.id
    this.joints = [...options.joints]
    this.inverseBindMatrices = options.inverseBindMatrices?.slice() ?? identityMatrices(options.joints.length)
    this.palette = new Float32Array(expected)
    this.update()
  }

  update(): this {
    this.assertAlive()
    for (const joint of this.joints) joint.updateWorldFromRoot()
    for (let index = 0; index < this.joints.length; index += 1) {
      const joint = this.joints[index]
      if (!joint) continue
      this.inverse.elements.set(this.inverseBindMatrices.subarray(index * 16, index * 16 + 16))
      this.combined.multiplyMatrices(joint.worldMatrix, this.inverse)
      this.palette.set(this.combined.elements, index * 16)
    }
    this.version += 1
    return this
  }

  protected release(): void {
    this.palette.fill(0)
    this.version += 1
  }
}

function identityMatrices(count: number): Float32Array {
  const output = new Float32Array(count * 16)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 16
    output[offset] = 1
    output[offset + 5] = 1
    output[offset + 10] = 1
    output[offset + 15] = 1
  }
  return output
}
