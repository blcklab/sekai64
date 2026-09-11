import { Box3, Vector3 } from '@sekai64-internal/math'
import { Mesh, type Node, type Scene } from '@sekai64-internal/scene'

export interface StaticCollider {
  readonly id: string
  readonly bounds: Box3
  readonly node?: Node
  readonly enabled: boolean
}

export interface AddBoxColliderOptions {
  id: string
  min: Vector3 | readonly [number, number, number]
  max: Vector3 | readonly [number, number, number]
  node?: Node
  enabled?: boolean
}

class BoxCollider implements StaticCollider {
  readonly bounds: Box3
  enabled: boolean
  constructor(readonly id: string, min: Vector3 | readonly number[], max: Vector3 | readonly number[], readonly node?: Node, enabled = true) {
    this.bounds = new Box3(toVector(min), toVector(max))
    this.enabled = enabled
  }
}

export class CollisionWorld {
  readonly cellSize: number
  private readonly colliders = new Map<string, StaticCollider>()
  private readonly cells = new Map<string, Set<StaticCollider>>()

  constructor(cellSize = 4) { this.cellSize = Math.max(0.25, cellSize) }

  addBox(options: AddBoxColliderOptions): StaticCollider {
    if (this.colliders.has(options.id)) throw new Error(`Collision collider already exists: ${options.id}`)
    const collider = new BoxCollider(options.id, options.min, options.max, options.node, options.enabled ?? true)
    this.colliders.set(collider.id, collider)
    this.index(collider)
    return collider
  }

  addMesh(mesh: Mesh, id = mesh.id): StaticCollider {
    mesh.updateWorldFromRoot()
    const bounds = mesh.geometry.bounds.clone().applyMatrix4(mesh.worldMatrix)
    return this.addBox({ id, min: bounds.min, max: bounds.max, node: mesh })
  }

  addScene(scene: Scene, predicate: (mesh: Mesh) => boolean = mesh => mesh.hasTag('collision')): number {
    scene.updateWorldMatrix()
    let count = 0
    scene.traverse(node => {
      if (node instanceof Mesh && predicate(node)) { this.addMesh(node, node.id || `collider-${count}`); count += 1 }
    })
    return count
  }

  remove(id: string): boolean {
    const collider = this.colliders.get(id)
    if (!collider) return false
    this.colliders.delete(id)
    for (const group of this.cells.values()) group.delete(collider)
    return true
  }

  clear(): void { this.colliders.clear(); this.cells.clear() }
  get(id: string): StaticCollider | undefined { return this.colliders.get(id) }
  get size(): number { return this.colliders.size }

  query(bounds: Box3): StaticCollider[] {
    const result = new Set<StaticCollider>()
    const minimum = this.cell(bounds.min)
    const maximum = this.cell(bounds.max)
    for (let x = minimum.x; x <= maximum.x; x += 1) {
      for (let y = minimum.y; y <= maximum.y; y += 1) {
        for (let z = minimum.z; z <= maximum.z; z += 1) {
          for (const collider of this.cells.get(key(x, y, z)) ?? []) if (collider.enabled && collider.bounds.intersectsBox(bounds)) result.add(collider)
        }
      }
    }
    return [...result]
  }

  private index(collider: StaticCollider): void {
    const minimum = this.cell(collider.bounds.min)
    const maximum = this.cell(collider.bounds.max)
    for (let x = minimum.x; x <= maximum.x; x += 1) {
      for (let y = minimum.y; y <= maximum.y; y += 1) {
        for (let z = minimum.z; z <= maximum.z; z += 1) {
          const id = key(x, y, z)
          let group = this.cells.get(id)
          if (!group) { group = new Set(); this.cells.set(id, group) }
          group.add(collider)
        }
      }
    }
  }
  private cell(value: Vector3): Vector3 { return new Vector3(Math.floor(value.x / this.cellSize), Math.floor(value.y / this.cellSize), Math.floor(value.z / this.cellSize)) }
}

function key(x: number, y: number, z: number): string { return `${x}:${y}:${z}` }
function toVector(value: Vector3 | readonly number[]): Vector3 { return value instanceof Vector3 ? value.clone() : new Vector3().fromArray(value) }
