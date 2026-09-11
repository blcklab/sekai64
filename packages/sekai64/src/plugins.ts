import { createBuildingObject, type BuildingSceneObjectDefinition } from '@sekai64-internal/buildings'
import { GltfLoader } from '@sekai64-internal/gltf'
import type { InteractionManager } from '@sekai64-internal/interaction'
import type { SceneObjectDefinition } from './json.js'
import type { Engine, EnginePlugin } from './Engine.js'

export function createBuildingsPlugin(): EnginePlugin {
  return {
    name: 'sekai64-buildings',
    setup(context) {
      const cleanups = ['building', 'text-panel', 'image-panel', 'product-display'].map(type =>
        context.registerObjectType(type, (definition, path) => createBuildingObject(definition as unknown as BuildingSceneObjectDefinition, path))
      )
      return () => { for (const cleanup of cleanups.reverse()) cleanup() }
    }
  }
}

export interface GltfPluginOptions { baseUrl?: string | URL }
export function createGltfPlugin(options: GltfPluginOptions = {}): EnginePlugin {
  const loader = new GltfLoader()
  return {
    name: 'sekai64-gltf',
    setup(context) {
      const unregister = context.registerObjectType('gltf-model', async (definition: SceneObjectDefinition, path: string) => {
        const source = (definition as Record<string, unknown>).source
        if (typeof source !== 'string') throw new Error(`${path}.source must be a glTF or GLB URL.`)
        const resolved = options.baseUrl ? new URL(source, options.baseUrl) : source
        return loader.loadNode(resolved, { id: definition.id, name: definition.name })
      })
      return () => { unregister(); loader.dispose() }
    }
  }
}

export interface BrowserActionsPluginOptions { allowedProtocols?: readonly string[]; navigate?: (url: URL) => void }
export function createBrowserActionsPlugin(options: BrowserActionsPluginOptions = {}): EnginePlugin {
  const allowed = new Set(options.allowedProtocols ?? ['http:', 'https:', 'mailto:'])
  return {
    name: 'sekai64-browser-actions',
    setup(context) {
      return context.registerSceneAction('open-url', value => {
        if (typeof value !== 'string') throw new Error('open-url requires a string URL.')
        const url = new URL(value, typeof location !== 'undefined' ? location.href : 'https://localhost/')
        if (!allowed.has(url.protocol)) throw new Error(`URL protocol is not allowed: ${url.protocol}`)
        if (options.navigate) options.navigate(url)
        else if (typeof window !== 'undefined') window.location.assign(url.href)
        else throw new Error('Browser navigation is unavailable in this environment.')
      })
    }
  }
}

export function bindJsonInteractions(engine: Engine, manager: InteractionManager, definition: { scene: { objects?: readonly SceneObjectDefinition[] } }): () => void {
  const cleanups: Array<() => void> = []
  const visit = (objects: readonly SceneObjectDefinition[]): void => {
    for (const object of objects) {
      if (object.id && object.interactions) {
        const node = manager.scene.get(object.id)
        if (node) {
          for (const [eventName, action] of Object.entries(object.interactions)) {
            if (!isInteractionType(eventName)) continue
            cleanups.push(manager.onObject(node, eventName, event => { void engine.runSceneAction(action.action, action.value, { objectId: object.id, source: event.originalEvent }) }))
          }
        }
      }
      if (object.children) visit(object.children)
    }
  }
  visit(definition.scene.objects ?? [])
  return () => { for (const cleanup of cleanups.reverse()) cleanup() }
}

function isInteractionType(value: string): value is 'pointerenter'|'pointerleave'|'pointermove'|'pointerdown'|'pointerup'|'click'|'doubleclick'|'focus'|'blur' {
  return ['pointerenter','pointerleave','pointermove','pointerdown','pointerup','click','doubleclick','focus','blur'].includes(value)
}
