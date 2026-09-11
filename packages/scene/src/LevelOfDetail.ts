import { Box3, Vector3 } from '@sekai64-internal/math'
import { Mesh } from './Mesh.js'
import { Node, type NodeOptions } from './Node.js'

export type LevelOfDetailMode = 'distance' | 'screen-size'

export interface LevelOfDetailEntry {
  node: Node
  /** Distance threshold used by distance mode. */
  distance: number
  /** Minimum projected diameter in CSS pixels used by screen-size mode. */
  screenSize?: number
}

export interface LevelOfDetailOptions extends NodeOptions {
  mode?: LevelOfDetailMode
}

export interface LevelOfDetailSelectionContext {
  viewportHeight?: number
  projectionScaleY?: number
}

export class LevelOfDetail extends Node {
  readonly levels: LevelOfDetailEntry[] = []
  mode: LevelOfDetailMode
  private selectedIndexValue = -1
  private localRadius = -1

  constructor(options: LevelOfDetailOptions = {}) {
    super({ ...options, tags: [...(options.tags ?? []), 'lod'] })
    this.mode = options.mode ?? 'distance'
  }

  get selectedIndex(): number { return this.selectedIndexValue }

  addLevel(node: Node, distance = 0): this {
    if (!(distance >= 0)) throw new Error('LOD distance must be non-negative.')
    this.levels.push({ node, distance })
    this.levels.sort((a, b) => a.distance - b.distance)
    this.add(node)
    this.localRadius = -1
    return this
  }

  addScreenLevel(node: Node, minimumScreenSize: number): this {
    if (!(minimumScreenSize >= 0)) throw new Error('LOD screen size must be non-negative.')
    this.mode = 'screen-size'
    this.levels.push({ node, distance: 0, screenSize: minimumScreenSize })
    this.levels.sort((a, b) => (b.screenSize ?? 0) - (a.screenSize ?? 0))
    this.add(node)
    this.localRadius = -1
    return this
  }

  updateForCamera(cameraPosition: Vector3, hysteresis = 0.08, context: LevelOfDetailSelectionContext = {}): Node | undefined {
    const position = new Vector3().setFromMatrixPosition(this.worldMatrix)
    const distance = Math.max(0.0001, position.distanceTo(cameraPosition))
    let nextIndex = this.mode === 'screen-size'
      ? this.selectByScreenSize(distance, context)
      : this.selectByDistance(distance)

    if (this.selectedIndexValue >= 0 && nextIndex !== this.selectedIndexValue) {
      if (this.mode === 'distance') {
        const boundary = this.levels[Math.max(nextIndex, this.selectedIndexValue)]?.distance ?? 0
        const margin = Math.max(0.05, boundary * Math.max(0, Math.min(0.5, hysteresis)))
        if (nextIndex > this.selectedIndexValue && distance < boundary + margin) nextIndex = this.selectedIndexValue
        if (nextIndex < this.selectedIndexValue && distance > boundary - margin) nextIndex = this.selectedIndexValue
      } else {
        const projected = this.projectedDiameter(distance, context)
        const boundary = this.levels[Math.min(nextIndex, this.selectedIndexValue)]?.screenSize ?? 0
        const margin = Math.max(1, boundary * Math.max(0, Math.min(0.5, hysteresis)))
        if (nextIndex > this.selectedIndexValue && projected > boundary - margin) nextIndex = this.selectedIndexValue
        if (nextIndex < this.selectedIndexValue && projected < boundary + margin) nextIndex = this.selectedIndexValue
      }
    }

    this.selectedIndexValue = Math.max(0, Math.min(this.levels.length - 1, nextIndex))
    const selected = this.levels[this.selectedIndexValue]
    for (let index = 0; index < this.levels.length; index += 1) {
      const level = this.levels[index]
      if (level) level.node.visible = index === this.selectedIndexValue
    }
    return selected?.node
  }

  override clone(recursive = true): LevelOfDetail {
    const copy = new LevelOfDetail({ id: this.id, name: this.name, tags: [...this.tags], visible: this.visible, layerMask: this.layerMask, mode: this.mode })
    copy.position.copy(this.position)
    copy.rotation.copy(this.rotation)
    copy.scale.copy(this.scale)
    if (recursive) {
      for (const level of this.levels) {
        if (level.screenSize !== undefined) copy.addScreenLevel(level.node.clone(true), level.screenSize)
        else copy.addLevel(level.node.clone(true), level.distance)
      }
    }
    return copy
  }

  private selectByDistance(distance: number): number {
    let nextIndex = 0
    for (let index = 0; index < this.levels.length; index += 1) {
      if (distance >= (this.levels[index]?.distance ?? 0)) nextIndex = index
    }
    return nextIndex
  }

  private selectByScreenSize(distance: number, context: LevelOfDetailSelectionContext): number {
    const projected = this.projectedDiameter(distance, context)
    for (let index = 0; index < this.levels.length; index += 1) {
      if (projected >= (this.levels[index]?.screenSize ?? 0)) return index
    }
    return Math.max(0, this.levels.length - 1)
  }

  private projectedDiameter(distance: number, context: LevelOfDetailSelectionContext): number {
    const viewportHeight = Math.max(1, context.viewportHeight ?? 1080)
    const projectionScaleY = Math.max(0.0001, Math.abs(context.projectionScaleY ?? 1))
    return (this.getLocalRadius() * 2 * projectionScaleY / distance) * viewportHeight * 0.5
  }

  private getLocalRadius(): number {
    if (this.localRadius >= 0) return this.localRadius
    const bounds = new Box3().makeEmpty()
    for (const level of this.levels) {
      level.node.traverse(node => {
        if (node instanceof Mesh && !node.geometry.disposed) bounds.expandByBox(node.geometry.bounds.clone().applyMatrix4(node.localMatrix))
      })
    }
    this.localRadius = bounds.isEmpty() ? 1 : bounds.getSize(new Vector3()).length() * 0.5
    return this.localRadius
  }
}
