import type { Camera } from '@sekai64-internal/cameras'
import { EventDispatcher } from '@sekai64-internal/core'
import { Vector2 } from '@sekai64-internal/math'
import type { Node, Scene } from '@sekai64-internal/scene'
import { Raycaster, type RaycastHit } from './Raycaster.js'

export type InteractionType = 'pointerenter' | 'pointerleave' | 'pointermove' | 'pointerdown' | 'pointerup' | 'click' | 'doubleclick' | 'focus' | 'blur'

export interface InteractionEvent {
  type: InteractionType
  object: Node
  target: Node
  currentTarget: Node
  point?: RaycastHit['point']
  normal?: RaycastHit['normal']
  distance?: number
  originalEvent?: Event
  stopped: boolean
  stopPropagation(): void
}

interface ManagerEvents { selectionChanged: { previous?: Node; current?: Node }; hoverChanged: { previous?: Node; current?: Node } }
type InteractionHandler = (event: InteractionEvent) => void

export interface InteractionManagerOptions {
  scene: Scene
  camera: Camera
  element?: HTMLElement
  autoAttach?: boolean
  layerMask?: number
}

export class InteractionManager extends EventDispatcher<ManagerEvents> {
  readonly scene: Scene
  readonly camera: Camera
  readonly raycaster = new Raycaster()
  selected?: Node
  hovered?: Node
  enabled = true
  disposed = false
  private readonly element?: HTMLElement
  private readonly handlers = new WeakMap<Node, Map<InteractionType, Set<InteractionHandler>>>()
  private readonly pointer = new Vector2()

  constructor(options: InteractionManagerOptions) {
    super()
    this.scene = options.scene
    this.camera = options.camera
    this.element = options.element
    this.raycaster.layerMask = options.layerMask ?? 0xffffffff
    if (options.autoAttach !== false) this.attach()
  }

  onObject(node: Node, type: InteractionType, handler: InteractionHandler): () => void {
    let byType = this.handlers.get(node)
    if (!byType) { byType = new Map(); this.handlers.set(node, byType) }
    let handlers = byType.get(type)
    if (!handlers) { handlers = new Set(); byType.set(type, handlers) }
    handlers.add(handler)
    return () => handlers?.delete(handler)
  }

  pick(clientX: number, clientY: number): RaycastHit | undefined {
    if (!this.element) return undefined
    const rect = this.element.getBoundingClientRect()
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const y = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1)
    this.pointer.set(x, y)
    return this.raycaster.setFromCamera(this.pointer, this.camera).intersectScene(this.scene, { firstHitOnly: true })[0]
  }

  dispatch(type: InteractionType, hit: RaycastHit | undefined, originalEvent?: Event): void {
    const target = hit?.object
    if (!target) return
    const event: InteractionEvent = {
      type, object: target, target, currentTarget: target,
      point: hit.point, normal: hit.normal, distance: hit.distance, originalEvent, stopped: false,
      stopPropagation() { this.stopped = true }
    }
    const path: Node[] = []
    let current: Node | null = target
    while (current) { path.push(current); current = current.parent }
    for (const node of path) {
      event.currentTarget = node
      const group = this.handlers.get(node)?.get(type)
      if (group) for (const handler of [...group]) { handler(event); if (event.stopped) return }
    }
  }

  setSelection(node: Node | undefined): void {
    if (node === this.selected) return
    const previous = this.selected
    if (previous) this.dispatch('blur', previous instanceof Object ? this.hitForNode(previous) : undefined)
    this.selected = node
    if (node) this.dispatch('focus', this.hitForNode(node))
    this.emit('selectionChanged', { previous, current: node })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach(); this.selected = undefined; this.hovered = undefined; this.clearListeners()
  }

  private attach(): void {
    this.element?.addEventListener('pointermove', this.onPointerMove)
    this.element?.addEventListener('pointerdown', this.onPointerDown)
    this.element?.addEventListener('pointerup', this.onPointerUp)
    this.element?.addEventListener('click', this.onClick)
    this.element?.addEventListener('dblclick', this.onDoubleClick)
  }
  private detach(): void {
    this.element?.removeEventListener('pointermove', this.onPointerMove)
    this.element?.removeEventListener('pointerdown', this.onPointerDown)
    this.element?.removeEventListener('pointerup', this.onPointerUp)
    this.element?.removeEventListener('click', this.onClick)
    this.element?.removeEventListener('dblclick', this.onDoubleClick)
  }
  private updateHover(hit: RaycastHit | undefined, originalEvent: Event): void {
    const next = hit?.object
    if (next !== this.hovered) {
      const previous = this.hovered
      if (previous) this.dispatch('pointerleave', this.hitForNode(previous), originalEvent)
      this.hovered = next
      if (next && hit) this.dispatch('pointerenter', hit, originalEvent)
      this.emit('hoverChanged', { previous, current: next })
    }
  }
  private hitForNode(node: Node): RaycastHit | undefined {
    return this.raycaster.intersectObjects([node], { firstHitOnly: true })[0]
  }
  private readonly onPointerMove = (event: PointerEvent): void => { if (!this.enabled) return; const hit = this.pick(event.clientX, event.clientY); this.updateHover(hit, event); this.dispatch('pointermove', hit, event) }
  private readonly onPointerDown = (event: PointerEvent): void => { if (this.enabled) this.dispatch('pointerdown', this.pick(event.clientX, event.clientY), event) }
  private readonly onPointerUp = (event: PointerEvent): void => { if (this.enabled) this.dispatch('pointerup', this.pick(event.clientX, event.clientY), event) }
  private readonly onClick = (event: MouseEvent): void => { if (!this.enabled) return; const hit = this.pick(event.clientX, event.clientY); this.dispatch('click', hit, event); this.setSelection(hit?.object) }
  private readonly onDoubleClick = (event: MouseEvent): void => { if (this.enabled) this.dispatch('doubleclick', this.pick(event.clientX, event.clientY), event) }
}
