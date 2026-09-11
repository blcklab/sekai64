import { InstancedMesh } from './InstancedMesh.js'
import { Mesh } from './Mesh.js'
import { Node } from './Node.js'

export interface StaticBatchOptions {
  minInstances?: number
  includeTransparent?: boolean
}

export interface StaticBatchResult {
  batches: number
  sourceMeshes: number
  instances: number
}

/**
 * Converts repeated static sibling meshes that share the exact geometry and material
 * resources into InstancedMesh nodes. Animated/tagged meshes and resources shared
 * outside a batch are deliberately left untouched.
 */
export function batchStaticMeshes(root: Node, options: StaticBatchOptions = {}): StaticBatchResult {
  const minimum = Math.max(2, Math.floor(options.minInstances ?? 3))
  const usage = new Map<object, number>()
  root.traverse(node => {
    if (!(node instanceof Mesh) || node instanceof InstancedMesh) return
    usage.set(node.geometry, (usage.get(node.geometry) ?? 0) + 1)
    usage.set(node.material, (usage.get(node.material) ?? 0) + 1)
  })

  let batches = 0
  let sourceMeshes = 0
  let instances = 0

  const visit = (parent: Node): void => {
    const ids = new WeakMap<object, number>()
    let nextId = 1
    const resourceId = (value: object): number => {
      const existing = ids.get(value)
      if (existing !== undefined) return existing
      const created = nextId++
      ids.set(value, created)
      return created
    }
    const groups = new Map<string, Mesh[]>()
    for (const child of parent.children) {
      if (!(child instanceof Mesh) || child instanceof InstancedMesh) continue
      if (child.tags.has('gltf-animated') || child.tags.has('no-static-batch')) continue
      if (child.material.transparent && !options.includeTransparent) continue
      const key = [
        resourceId(child.geometry),
        resourceId(child.material),
        child.castShadow ? 1 : 0,
        child.receiveShadow ? 1 : 0,
      ].join(':')
      const group = groups.get(key) ?? []
      group.push(child)
      groups.set(key, group)
    }

    for (const group of groups.values()) {
      if (group.length < minimum) continue
      const first = group[0]
      if (!first) continue
      if (usage.get(first.geometry) !== group.length || usage.get(first.material) !== group.length) continue
      const matrices = new Float32Array(group.length * 16)
      for (let index = 0; index < group.length; index += 1) {
        const mesh = group[index]
        if (!mesh) continue
        mesh.localMatrix.compose(mesh.position, mesh.rotation, mesh.scale)
        matrices.set(mesh.localMatrix.elements, index * 16)
      }
      const batch = new InstancedMesh({
        id: `${first.id || 'gltf-static'}-batch`,
        name: `${first.name || 'static mesh'} batch`,
        tags: [...first.tags, 'static-batch'],
        geometry: first.geometry,
        material: first.material,
        ownsGeometry: first.ownsGeometry,
        ownsMaterial: first.ownsMaterial,
        castShadow: first.castShadow,
        receiveShadow: first.receiveShadow,
        count: group.length,
        matrices,
      })
      for (const mesh of group) {
        mesh.setGeometry(mesh.geometry, { ownsResource: false, disposePrevious: false })
        mesh.setMaterial(mesh.material, { ownsResource: false, disposePrevious: false })
        parent.remove(mesh)
        mesh.dispose()
      }
      parent.add(batch)
      batches += 1
      sourceMeshes += group.length
      instances += group.length
    }

    for (const child of [...parent.children]) {
      if (!(child instanceof InstancedMesh)) visit(child)
    }
  }

  visit(root)
  return { batches, sourceMeshes, instances }
}
