import type { Geometry } from '@sekai64-internal/geometry'
import type { Material } from '@sekai64-internal/materials'
import { Node, type NodeOptions } from './Node.js'

export interface MeshOptions extends NodeOptions {
  geometry: Geometry
  material: Material
  /** Backward-compatible shorthand that makes the mesh own both resources. */
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
  material: Material
  castShadow: boolean
  receiveShadow: boolean
  private ownsGeometryValue: boolean
  private ownsMaterialValue: boolean

  constructor(options: MeshOptions) {
    super(options)
    this.geometry = options.geometry
    this.material = options.material
    this.castShadow = options.castShadow ?? true
    this.receiveShadow = options.receiveShadow ?? true
    const ownsBoth = options.ownsResources ?? false
    this.ownsGeometryValue = options.ownsGeometry ?? ownsBoth
    this.ownsMaterialValue = options.ownsMaterial ?? ownsBoth
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

  setMaterial(material: Material, options: ReplaceResourceOptions = {}): this {
    this.assertAlive()
    if (material === this.material) {
      if (options.ownsResource !== undefined) this.ownsMaterialValue = options.ownsResource
      return this
    }
    const previous = this.material
    const previousOwned = this.ownsMaterialValue
    this.material = material
    this.ownsMaterialValue = options.ownsResource ?? previousOwned
    if (options.disposePrevious ?? previousOwned) previous.dispose()
    return this
  }

  override clone(recursive = true): Mesh {
    const copy = new Mesh({ id: this.id, name: this.name, tags: [...this.tags], visible: this.visible, layerMask: this.layerMask, geometry: this.geometry, material: this.material, ownsResources: false, castShadow: this.castShadow, receiveShadow: this.receiveShadow })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) for (const child of this.children) copy.add(child.clone(true))
    return copy
  }

  override dispose(): void {
    if (this.disposed) return
    const geometry = this.geometry
    const material = this.material
    const ownsGeometry = this.ownsGeometryValue
    const ownsMaterial = this.ownsMaterialValue
    super.dispose()
    if (ownsGeometry) geometry.dispose()
    if (ownsMaterial) material.dispose()
  }
}
