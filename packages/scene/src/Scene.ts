import { Node, type NodeOptions, type NodeRegistry } from './Node.js'

export interface SceneOptions extends NodeOptions {
  autoDisposeResources?: boolean
}

export class Scene extends Node implements NodeRegistry {
  private readonly nodes = new Map<string, Node>()
  private nextNodeNumber = 1
  readonly autoDisposeResources: boolean

  constructor(options: SceneOptions = {}) {
    super({ ...options, id: options.id ?? 'scene', name: options.name ?? 'Scene' })
    this.autoDisposeResources = options.autoDisposeResources ?? true
    this.attachRegistry(this)
  }

  get(id: string): Node | undefined { return this.nodes.get(id) }

  require(id: string): Node {
    const node = this.get(id)
    if (!node) throw new Error(`Scene node not found: ${id}`)
    return node
  }

  findByTag(tag: string): Node[] {
    const matches: Node[] = []
    for (const node of this.nodes.values()) if (node.hasTag(tag)) matches.push(node)
    return matches
  }

  register(node: Node): void {
    if (!node.id) node.assignId(`node-${this.nextNodeNumber++}`)
    const existing = this.nodes.get(node.id)
    if (existing && existing !== node) throw new Error(`Duplicate scene node ID: ${node.id}`)
    this.nodes.set(node.id, node)
  }

  unregister(node: Node): void {
    if (this.nodes.get(node.id) === node) this.nodes.delete(node.id)
  }

  override clone(recursive = true): Scene {
    const copy = new Scene({ id: this.id, name: this.name, tags: [...this.tags], visible: this.visible, layerMask: this.layerMask, autoDisposeResources: this.autoDisposeResources })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) for (const child of this.children) copy.add(child.clone(true))
    return copy
  }
}

export function createScene(options?: SceneOptions): Scene { return new Scene(options) }
