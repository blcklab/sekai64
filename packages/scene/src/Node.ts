import { EventDispatcher } from '@sekai64-internal/core'
import { Euler, Matrix4, Vector3 } from '@sekai64-internal/math'

export interface NodeOptions {
  id?: string
  name?: string
  tags?: readonly string[]
  visible?: boolean
  layerMask?: number
}

export interface NodeEvents {
  added: { node: Node; parent: Node }
  removed: { node: Node; parent: Node }
  disposed: { node: Node }
}

export interface TransformUpdateStats {
  visited: number
  updated: number
  skippedSubtrees: number
}

export interface TransformState {
  position?: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number]
}

export interface NodeRegistry {
  register(node: Node): void
  unregister(node: Node): void
}

export class Node extends EventDispatcher<NodeEvents> {
  private _id: string
  name: string
  readonly tags: Set<string>
  private _visible: boolean
  worldVisible = true
  layerMask: number
  readonly position: Vector3
  readonly rotation: Euler
  readonly scale: Vector3
  readonly localMatrix = new Matrix4()
  readonly worldMatrix = new Matrix4()
  parent: Node | null = null
  readonly children: Node[] = []
  disposed = false
  private localDirty = true
  private worldDirty = true
  private subtreeDirty = true
  private registry: NodeRegistry | undefined
  worldVersion = 0

  constructor(options: NodeOptions = {}) {
    super()
    this._id = options.id ?? ''
    this.name = options.name ?? ''
    this.tags = new Set(options.tags ?? [])
    this._visible = options.visible ?? true
    this.layerMask = options.layerMask ?? 0xffffffff
    const changed = () => this.markTransformDirty()
    this.position = new Vector3(0, 0, 0, changed)
    this.rotation = new Euler(0, 0, 0, 'XYZ', changed)
    this.scale = new Vector3(1, 1, 1, changed)
  }

  get id(): string { return this._id }
  get visible(): boolean { return this._visible }
  set visible(value: boolean) {
    if (this._visible === value) return
    this._visible = value
    this.markWorldDirty()
  }

  setVisible(visible: boolean): this { this.assertAlive(); this.visible = visible; return this }

  setTransform(transform: TransformState): this {
    this.assertAlive()
    if (transform.position) this.position.fromArray(transform.position)
    if (transform.rotation) this.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
    if (transform.scale) this.scale.fromArray(transform.scale)
    return this
  }

  removeFromParent(): this { this.parent?.remove(this); return this }

  add(...nodes: readonly Node[]): this {
    this.assertAlive()
    for (const node of nodes) {
      if (node === this || node.isAncestorOf(this)) throw new Error('A node cannot be added to itself or one of its descendants.')
      if (node.parent === this) continue
      node.parent?.remove(node)
      node.parent = this
      this.children.push(node)
      node.attachRegistry(this.registry)
      node.markWorldDirty()
      this.markSubtreeDirtyUp()
      node.emit('added', { node, parent: this })
    }
    return this
  }

  remove(...nodes: readonly Node[]): this {
    for (const node of nodes) {
      const index = this.children.indexOf(node)
      if (index < 0) continue
      this.children.splice(index, 1)
      node.attachRegistry(undefined)
      node.parent = null
      node.markWorldDirty()
      this.markSubtreeDirtyUp()
      node.emit('removed', { node, parent: this })
    }
    return this
  }

  traverse(visitor: (node: Node) => void): void {
    visitor(this)
    for (const child of this.children) child.traverse(visitor)
  }

  updateWorldMatrix(parentChanged = false, stats?: TransformUpdateStats): void {
    if (stats) stats.visited += 1
    if (!parentChanged && !this.localDirty && !this.worldDirty && !this.subtreeDirty) {
      if (stats) stats.skippedSubtrees += 1
      return
    }
    if (this.localDirty) {
      this.localMatrix.compose(this.position, this.rotation, this.scale)
      this.localDirty = false
      this.worldDirty = true
    }
    const changed = parentChanged || this.worldDirty
    if (changed) {
      if (this.parent) this.worldMatrix.multiplyMatrices(this.parent.worldMatrix, this.localMatrix)
      else this.worldMatrix.copy(this.localMatrix)
      this.worldVisible = this.visible && (this.parent?.worldVisible ?? true)
      this.worldDirty = false
      this.worldVersion += 1
      if (stats) stats.updated += 1
    }
    this.subtreeDirty = false
    for (const child of this.children) child.updateWorldMatrix(changed, stats)
  }

  updateWorldMatrixTracked(parentChanged = false): TransformUpdateStats {
    const stats: TransformUpdateStats = { visited: 0, updated: 0, skippedSubtrees: 0 }
    this.updateWorldMatrix(parentChanged, stats)
    return stats
  }

  updateWorldFromRoot(): void {
    let root: Node = this
    while (root.parent) root = root.parent
    root.updateWorldMatrix()
  }

  clone(recursive = true): Node {
    const copy = new Node({ id: this.id, name: this.name, tags: [...this.tags], visible: this.visible, layerMask: this.layerMask })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) for (const child of this.children) copy.add(child.clone(true))
    return copy
  }

  dispose(): void {
    if (this.disposed) return
    if (this.parent) this.parent.remove(this)
    for (const child of [...this.children]) child.dispose()
    this.children.length = 0
    this.attachRegistry(undefined)
    this.disposed = true
    this.emit('disposed', { node: this })
    this.clearListeners()
  }

  hasTag(tag: string): boolean { return this.tags.has(tag) }

  protected assertAlive(): void {
    if (this.disposed) throw new Error(`Node ${this.id || this.name || '<unregistered>'} is disposed.`)
  }

  protected attachRegistry(registry: NodeRegistry | undefined): void {
    if (this.registry === registry) return
    if (this.registry) this.registry.unregister(this)
    this.registry = registry
    if (registry) registry.register(this)
    for (const child of this.children) child.attachRegistry(registry)
  }

  assignId(id: string): void {
    if (this._id && this._id !== id) throw new Error(`Node ID is already assigned as ${this._id}.`)
    this._id = id
  }

  private markTransformDirty(): void {
    this.localDirty = true
    this.markWorldDirty()
  }

  private markWorldDirty(): void {
    const wasDirty = this.worldDirty
    this.worldDirty = true
    this.subtreeDirty = true
    this.parent?.markSubtreeDirtyUp()
    if (wasDirty) return
    for (const child of this.children) child.markWorldDirty()
  }

  private markSubtreeDirtyUp(): void {
    if (!this.subtreeDirty) this.subtreeDirty = true
    this.parent?.markSubtreeDirtyUp()
  }

  private isAncestorOf(node: Node): boolean {
    let current = node.parent
    while (current) {
      if (current === this) return true
      current = current.parent
    }
    return false
  }
}
