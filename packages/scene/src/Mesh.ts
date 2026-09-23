import type { Geometry } from '@sekai64-internal/geometry'
import type { Material } from '@sekai64-internal/materials'
import { Node, type NodeOptions } from './Node.js'

export interface MeshOptions extends NodeOptions {
  geometry: Geometry
  /** Backward-compatible slot-0 material. Required when `materials` is omitted. */
  material?: Material
  /** Optional material slots used by Geometry.groups. Slot 0 remains available as `mesh.material`. */
  materials?: readonly Material[]
  /** Optional semantic geometry-group name -> material slot override. */
  materialGroupSlots?: Readonly<Record<string, number>>
  /** Backward-compatible shorthand that makes the mesh own geometry and every material slot. */
  ownsResources?: boolean
  ownsGeometry?: boolean
  ownsMaterial?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
}

export interface ReplaceResourceOptions {
  /** Dispose the previous resource immediately. Defaults to whether the mesh owned it. */
  disposePrevious?: boolean
  /** Whether the mesh owns the replacement resource. Defaults to the current ownership state. */
  ownsResource?: boolean
}

export class Mesh extends Node {
  geometry: Geometry
  private materialSlots: Material[]
  private materialGroupSlotMap: Readonly<Record<string, number>>
  castShadow: boolean
  receiveShadow: boolean
  private ownsGeometryValue: boolean
  private ownsMaterialValue: boolean

  constructor(options: MeshOptions) {
    super(options)
    this.geometry = options.geometry
    const slots = options.materials ? [...options.materials] : options.material ? [options.material] : []
    if (slots.length === 0) throw new Error('Mesh requires at least one material slot.')
    this.materialSlots = slots
    this.materialGroupSlotMap = normalizeMaterialGroupSlots(options.materialGroupSlots, slots.length)
    this.castShadow = options.castShadow ?? true
    this.receiveShadow = options.receiveShadow ?? true
    const ownsBoth = options.ownsResources ?? false
    this.ownsGeometryValue = options.ownsGeometry ?? ownsBoth
    this.ownsMaterialValue = options.ownsMaterial ?? ownsBoth
  }

  /** Backward-compatible slot-0 material. */
  get material(): Material { return this.materialSlots[0]! }
  get materials(): readonly Material[] { return this.materialSlots }
  get materialGroupSlots(): Readonly<Record<string, number>> { return this.materialGroupSlotMap }
  materialAt(index: number): Material { return this.materialSlots[index] ?? this.material }
  materialForGroup(materialIndex: number, name?: string): Material {
    const slot = name ? this.materialGroupSlotMap[name] ?? materialIndex : materialIndex
    return this.materialAt(slot)
  }

  get ownsGeometry(): boolean { return this.ownsGeometryValue }
  get ownsMaterial(): boolean { return this.ownsMaterialValue }
  get ownsResources(): boolean { return this.ownsGeometryValue && this.ownsMaterialValue }
  set ownsResources(value: boolean) { this.ownsGeometryValue = value; this.ownsMaterialValue = value }

  setGeometry(geometry: Geometry, options: ReplaceResourceOptions = {}): this {
    this.assertAlive()
    if (geometry === this.geometry) {
      if (options.ownsResource !== undefined) this.ownsGeometryValue = options.ownsResource
      return this
    }
    const previous = this.geometry
    const previousOwned = this.ownsGeometryValue
    this.geometry = geometry
    this.ownsGeometryValue = options.ownsResource ?? previousOwned
    if (options.disposePrevious ?? previousOwned) previous.dispose()
    return this
  }

  /** Backward-compatible replacement: set slot 0 and clear additional slots. */
  setMaterial(material: Material, options: ReplaceResourceOptions = {}): this {
    return this.setMaterials([material], options)
  }

  setMaterials(materials: readonly Material[], options: ReplaceResourceOptions = {}): this {
    this.assertAlive()
    if (materials.length === 0) throw new Error('Mesh requires at least one material slot.')
    const next = [...materials]
    if (next.length === this.materialSlots.length && next.every((value, index) => value === this.materialSlots[index])) {
      if (options.ownsResource !== undefined) this.ownsMaterialValue = options.ownsResource
      return this
    }
    const previous = this.materialSlots
    const previousOwned = this.ownsMaterialValue
    this.materialSlots = next
    this.ownsMaterialValue = options.ownsResource ?? previousOwned
    if (options.disposePrevious ?? previousOwned) for (const material of new Set(previous)) if (!next.includes(material)) material.dispose()
    return this
  }

  setMaterialGroupSlots(slots: Readonly<Record<string, number>> | undefined): this {
    this.assertAlive()
    this.materialGroupSlotMap = normalizeMaterialGroupSlots(slots, this.materialSlots.length)
    return this
  }

  override clone(recursive = true): Mesh {
    const copy = new Mesh({ id: this.id, name: this.name, tags: [...this.tags], visible: this.visible, layerMask: this.layerMask, geometry: this.geometry, materials: this.materialSlots, materialGroupSlots: this.materialGroupSlotMap, ownsResources: false, castShadow: this.castShadow, receiveShadow: this.receiveShadow })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) for (const child of this.children) copy.add(child.clone(true))
    return copy
  }

  override dispose(): void {
    if (this.disposed) return
    const geometry = this.geometry
    const materials = [...this.materialSlots]
    const ownsGeometry = this.ownsGeometryValue
    const ownsMaterial = this.ownsMaterialValue
    super.dispose()
    if (ownsGeometry) geometry.dispose()
    if (ownsMaterial) for (const material of new Set(materials)) material.dispose()
  }
}

function normalizeMaterialGroupSlots(input: Readonly<Record<string, number>> | undefined, materialCount: number): Readonly<Record<string, number>> {
  if (!input) return Object.freeze({})
  const output: Record<string, number> = {}
  for (const [name, slot] of Object.entries(input)) {
    if (!name || !Number.isSafeInteger(slot) || slot < 0 || slot >= materialCount) throw new Error(`Mesh material group "${name}" references invalid material slot ${slot}.`)
    output[name] = slot
  }
  return Object.freeze(output)
}
