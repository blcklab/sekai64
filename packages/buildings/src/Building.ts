import { BasicMaterial, StandardMaterial, type Material } from '@sekai64-internal/materials'
import { BoxGeometry } from '@sekai64-internal/geometry'
import type { ColorInput } from '@sekai64-internal/math'
import { ImageMesh, Mesh, Node, TextMesh } from '@sekai64-internal/scene'

export type WallSide = 'front' | 'back' | 'left' | 'right'
export type OpeningType = 'door' | 'window' | 'portal'

export interface BuildingMaterialDefinition {
  floor?: ColorInput
  ceiling?: ColorInput
  wall?: ColorInput
  trim?: ColorInput
}

export interface WallOpeningDefinition {
  id?: string
  type: OpeningType
  wall: WallSide
  position?: number
  width: number
  height: number
  bottom?: number
}

export interface RoomDefinition {
  id: string
  position?: readonly [number, number]
  size: readonly [number, number]
  height?: number
  openings?: readonly WallOpeningDefinition[]
  materials?: BuildingMaterialDefinition
  ceiling?: boolean
}

export interface BuildingDefinition {
  id?: string
  name?: string
  width: number
  depth: number
  floors?: number
  floorHeight?: number
  floorThickness?: number
  wallThickness?: number
  rooms?: readonly RoomDefinition[]
  openings?: readonly WallOpeningDefinition[]
  materials?: BuildingMaterialDefinition
  includeCeiling?: boolean
}

export class Building extends Node {
  readonly definition: BuildingDefinition
  readonly generated = new Node({ id: 'generated', name: 'Generated building geometry' })
  constructor(definition: BuildingDefinition) {
    super({ id: definition.id, name: definition.name ?? 'Building', tags: ['building'] })
    validateBuilding(definition)
    this.definition = cloneDefinition(definition)
    this.add(this.generated)
    this.rebuild()
  }

  rebuild(next?: Partial<BuildingDefinition>): this {
    if (next) Object.assign(this.definition, cloneDefinition(next as BuildingDefinition))
    validateBuilding(this.definition)
    for (const child of [...this.generated.children]) child.dispose()
    const floors = this.definition.floors ?? 1
    const floorHeight = this.definition.floorHeight ?? 4
    for (let floor = 0; floor < floors; floor += 1) {
      const level = new Node({ id: `floor-${floor + 1}`, name: `Floor ${floor + 1}`, tags: ['building-floor'] })
      level.position.y = floor * floorHeight
      this.generated.add(level)
      generateShell(level, this.definition, floor)
      for (const room of this.definition.rooms ?? []) generateRoom(level, room, this.definition, floor)
    }
    return this
  }

  override clone(): Building { return new Building(this.definition) }
}

export function createBuilding(definition: BuildingDefinition): Building { return new Building(definition) }

function generateShell(parent: Node, definition: BuildingDefinition, floorIndex: number): void {
  const width = definition.width
  const depth = definition.depth
  const height = definition.floorHeight ?? 4
  const thickness = definition.wallThickness ?? 0.2
  const floorThickness = definition.floorThickness ?? 0.15
  const materials = definition.materials ?? {}
  parent.add(createPart(`shell-floor-${floorIndex + 1}`, [width, floorThickness, depth], [0, -floorThickness / 2, 0], materials.floor ?? '#777777', ['floor', 'collision']))
  if (definition.includeCeiling !== false) parent.add(createPart(`shell-ceiling-${floorIndex + 1}`, [width, floorThickness, depth], [0, height + floorThickness / 2, 0], materials.ceiling ?? '#eeeeee', ['ceiling', 'collision']))
  createWall(parent, 'front', width, height, thickness, [0, height / 2, depth / 2], definition.openings ?? [], materials.wall ?? '#e8e8e8', `shell-front-${floorIndex + 1}`)
  createWall(parent, 'back', width, height, thickness, [0, height / 2, -depth / 2], definition.openings ?? [], materials.wall ?? '#e8e8e8', `shell-back-${floorIndex + 1}`)
  createWall(parent, 'left', depth, height, thickness, [-width / 2, height / 2, 0], definition.openings ?? [], materials.wall ?? '#e8e8e8', `shell-left-${floorIndex + 1}`)
  createWall(parent, 'right', depth, height, thickness, [width / 2, height / 2, 0], definition.openings ?? [], materials.wall ?? '#e8e8e8', `shell-right-${floorIndex + 1}`)
}

function generateRoom(parent: Node, room: RoomDefinition, building: BuildingDefinition, floorIndex: number): void {
  const [x, z] = room.position ?? [0, 0]
  const [width, depth] = room.size
  const height = room.height ?? building.floorHeight ?? 4
  const thickness = building.wallThickness ?? 0.2
  const materials = { ...building.materials, ...room.materials }
  const root = new Node({ id: `${room.id}-floor-${floorIndex + 1}`, name: room.id, tags: ['room'] })
  root.position.set(x, 0, z)
  parent.add(root)
  createWall(root, 'front', width, height, thickness, [0, height / 2, depth / 2], room.openings ?? [], materials.wall ?? '#f2f2f2', `${room.id}-front`)
  createWall(root, 'back', width, height, thickness, [0, height / 2, -depth / 2], room.openings ?? [], materials.wall ?? '#f2f2f2', `${room.id}-back`)
  createWall(root, 'left', depth, height, thickness, [-width / 2, height / 2, 0], room.openings ?? [], materials.wall ?? '#f2f2f2', `${room.id}-left`)
  createWall(root, 'right', depth, height, thickness, [width / 2, height / 2, 0], room.openings ?? [], materials.wall ?? '#f2f2f2', `${room.id}-right`)
  if (room.ceiling) root.add(createPart(`${room.id}-ceiling`, [width, building.floorThickness ?? 0.15, depth], [0, height, 0], materials.ceiling ?? '#eeeeee', ['ceiling', 'collision']))
}

function createWall(parent: Node, side: WallSide, length: number, height: number, thickness: number, center: readonly [number, number, number], openings: readonly WallOpeningDefinition[], color: ColorInput, id: string): void {
  const matching = openings.filter(opening => opening.wall === side).map(opening => ({ ...opening, position: opening.position ?? 0, bottom: opening.bottom ?? (opening.type === 'window' ? 1 : 0) })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const intervals = matching.map(opening => ({ start: clamp((opening.position ?? 0) - opening.width / 2, -length / 2, length / 2), end: clamp((opening.position ?? 0) + opening.width / 2, -length / 2, length / 2), opening }))
  let cursor = -length / 2
  let segment = 0
  for (const interval of intervals) {
    if (interval.start > cursor) createHorizontalSegment(cursor, interval.start)
    const opening = interval.opening
    const bottom = opening.bottom ?? 0
    if (bottom > 0) createOpeningSegment(interval.start, interval.end, bottom / 2, bottom, 'lower')
    const topStart = bottom + opening.height
    if (topStart < height) createOpeningSegment(interval.start, interval.end, topStart + (height - topStart) / 2, height - topStart, 'upper')
    const marker = new OpeningMarker({ id: opening.id ?? `${id}-opening-${segment}`, opening, side })
    marker.position.set(...center)
    if (side === 'front' || side === 'back') marker.position.x += opening.position ?? 0
    else marker.position.z += opening.position ?? 0
    marker.position.y = bottom
    parent.add(marker)
    cursor = Math.max(cursor, interval.end)
    segment += 1
  }
  if (cursor < length / 2) createHorizontalSegment(cursor, length / 2)

  function createHorizontalSegment(start: number, end: number): void {
    const segmentLength = end - start
    const offset = (start + end) / 2
    const size: [number, number, number] = side === 'front' || side === 'back' ? [segmentLength, height, thickness] : [thickness, height, segmentLength]
    const position: [number, number, number] = [center[0], center[1], center[2]]
    if (side === 'front' || side === 'back') position[0] += offset
    else position[2] += offset
    parent.add(createPart(`${id}-segment-${segment++}`, size, position, color, ['wall', 'collision']))
  }
  function createOpeningSegment(start: number, end: number, y: number, segmentHeight: number, suffix: string): void {
    if (segmentHeight <= 0) return
    const segmentLength = end - start
    const offset = (start + end) / 2
    const size: [number, number, number] = side === 'front' || side === 'back' ? [segmentLength, segmentHeight, thickness] : [thickness, segmentHeight, segmentLength]
    const position: [number, number, number] = [center[0], y, center[2]]
    if (side === 'front' || side === 'back') position[0] += offset
    else position[2] += offset
    parent.add(createPart(`${id}-${suffix}-${segment++}`, size, position, color, ['wall', 'collision']))
  }
}

export class OpeningMarker extends Node {
  readonly opening: WallOpeningDefinition
  readonly side: WallSide
  constructor(options: { id: string; opening: WallOpeningDefinition; side: WallSide }) {
    super({ id: options.id, name: `${options.opening.type} opening`, tags: ['opening', options.opening.type] })
    this.opening = { ...options.opening }
    this.side = options.side
  }
}

export interface PanelOptions {
  id?: string
  width?: number
  height?: number
  /** Retained for source compatibility. Text and image panels now use a lighter four-vertex plane. */
  depth?: number
  color?: ColorInput
}

export class TextPanel extends TextMesh {
  constructor(text: string, options: PanelOptions = {}) {
    super(text, {
      id: options.id,
      tags: ['panel', 'text-panel', 'interactive'],
      worldWidth: options.width ?? 2,
      worldHeight: options.height ?? 0.8,
      color: '#ffffff',
      tint: options.color ?? '#ffffff',
      background: 'transparent',
      fontSize: 64
    })
  }
}

export class ImagePanel extends ImageMesh {
  readonly source: string
  constructor(source: string, options: PanelOptions = {}) {
    super(source, {
      id: options.id,
      tags: ['panel', 'image-panel', 'interactive'],
      worldWidth: options.width ?? 2,
      worldHeight: options.height ?? 1.2,
      tint: options.color ?? '#ffffff'
    })
    this.source = source
  }
}

export class ProductDisplay extends Mesh {
  productId: string
  metadata: Readonly<Record<string, unknown>>
  constructor(productId: string, options: PanelOptions & { metadata?: Readonly<Record<string, unknown>> } = {}) {
    super({ id: options.id ?? productId, tags: ['product', 'interactive', 'collision'], geometry: new BoxGeometry({ width: options.width ?? 1, height: options.height ?? 1.2, depth: options.depth ?? 1 }), material: createMaterial(options.color ?? '#d9d9d9'), ownsResources: true })
    this.productId = productId
    this.metadata = options.metadata ?? {}
  }
}

function createPart(id: string, size: readonly [number, number, number], position: readonly [number, number, number], color: ColorInput, tags: readonly string[]): Mesh {
  const mesh = new Mesh({ id, name: id, tags, geometry: new BoxGeometry({ width: size[0], height: size[1], depth: size[2], label: `${id}:geometry` }), material: createMaterial(color), ownsResources: true })
  mesh.position.fromArray(position)
  return mesh
}
function createMaterial(color: ColorInput): Material { return new StandardMaterial({ baseColor: color, roughness: 0.8, metallic: 0 }) }
function validateBuilding(value: BuildingDefinition): void {
  if (!(value.width > 0) || !(value.depth > 0)) throw new Error('Building width and depth must be greater than zero.')
  if ((value.floors ?? 1) < 1 || !Number.isInteger(value.floors ?? 1)) throw new Error('Building floors must be a positive integer.')
  for (const opening of [...(value.openings ?? []), ...(value.rooms ?? []).flatMap(room => room.openings ?? [])]) {
    if (!(opening.width > 0) || !(opening.height > 0)) throw new Error(`Building opening ${opening.id ?? '<unnamed>'} must have positive dimensions.`)
  }
}
function cloneDefinition<T>(value: T): T { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
