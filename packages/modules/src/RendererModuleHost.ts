import type { Camera } from '@sekai64-internal/cameras'
import type { Renderer, RendererDiagnostic } from '@sekai64-internal/renderer'
import type { Scene } from '@sekai64-internal/scene'
import type {
  InstalledRendererModule,
  RendererModule,
  RendererModuleCapabilities,
  RendererModuleFrame,
  RendererModuleInstance,
  RendererRecoveryContext,
} from './RendererModule.js'

interface InstalledState {
  module: RendererModule
  instance: RendererModuleInstance
  cleanups: Array<() => void | Promise<void>>
}

export class RendererModuleHost {
  private readonly states = new Map<string, InstalledState>()
  private disposed = false

  constructor(
    readonly renderer: Renderer,
    private readonly reportDiagnostic: (diagnostic: RendererDiagnostic) => void = () => undefined,
  ) {}

  async installAll(modules: readonly RendererModule[]): Promise<void> {
    this.assertAlive()
    const ordered = orderModules(modules)
    try {
      for (const module of ordered) await this.install(module)
    } catch (error) {
      await this.disposeAsync()
      throw error
    }
  }

  async install(module: RendererModule): Promise<() => Promise<void>> {
    this.assertAlive()
    if (!module.id.trim()) throw new Error('Renderer module id cannot be empty.')
    if (this.states.has(module.id)) throw new Error(`Renderer module is already installed: ${module.id}`)
    for (const dependency of module.requires ?? []) {
      if (!this.states.has(dependency)) throw new Error(`Renderer module ${module.id} requires ${dependency}.`)
    }
    const cleanups: Array<() => void | Promise<void>> = []
    const registerCleanup = (cleanup: () => void | Promise<void>): (() => void) => {
      cleanups.push(cleanup)
      let registered = true
      return () => {
        if (!registered) return
        registered = false
        const index = cleanups.indexOf(cleanup)
        if (index >= 0) cleanups.splice(index, 1)
      }
    }
    let instance: RendererModuleInstance = {}
    try {
      instance = (await module.setup({
        renderer: this.renderer,
        diagnostics: { report: diagnostic => this.reportDiagnostic(diagnostic) },
        registerCleanup,
      })) ?? {}
    } catch (error) {
      await runCleanups(cleanups)
      throw error
    }
    this.states.set(module.id, { module, instance, cleanups })
    return async () => this.uninstall(module.id)
  }

  update(frame: RendererModuleFrame): void {
    if (this.disposed) return
    for (const state of this.states.values()) state.instance.update?.(frame)
  }

  beforeRender(scene: Scene, camera: Camera): void {
    if (this.disposed) return
    for (const state of this.states.values()) state.instance.beforeRender?.(scene, camera)
  }

  afterRender(scene: Scene, camera: Camera): void {
    if (this.disposed) return
    for (const state of [...this.states.values()].reverse()) state.instance.afterRender?.(scene, camera)
  }

  async recover(context: RendererRecoveryContext): Promise<void> {
    this.assertAlive()
    for (const state of this.states.values()) await state.instance.recover?.(context)
  }

  has(id: string): boolean { return this.states.has(id) }

  get capabilities(): Readonly<Record<string, RendererModuleCapabilities>> {
    return Object.freeze(Object.fromEntries([...this.states].map(([id, state]) => [id, Object.freeze({ ...(state.instance.capabilities ?? {}) })])))
  }

  list(): readonly InstalledRendererModule[] {
    return [...this.states.values()].map(state => Object.freeze({
      id: state.module.id,
      ...(state.module.version ? { version: state.module.version } : {}),
      capabilities: Object.freeze({ ...(state.instance.capabilities ?? {}) }),
    }))
  }

  async uninstall(id: string): Promise<void> {
    const state = this.states.get(id)
    if (!state) return
    const dependents = [...this.states.values()].filter(value => value.module.requires?.includes(id))
    if (dependents.length > 0) throw new Error(`Cannot uninstall renderer module ${id}; required by ${dependents.map(value => value.module.id).join(', ')}.`)
    this.states.delete(id)
    await state.instance.dispose?.()
    await runCleanups(state.cleanups)
  }

  async disposeAsync(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    const states = [...this.states.values()].reverse()
    this.states.clear()
    for (const state of states) {
      try { await state.instance.dispose?.() }
      finally { await runCleanups(state.cleanups) }
    }
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('RendererModuleHost is disposed.')
  }
}

function orderModules(modules: readonly RendererModule[]): RendererModule[] {
  const byId = new Map<string, RendererModule>()
  for (const module of modules) {
    if (byId.has(module.id)) throw new Error(`Duplicate renderer module id: ${module.id}`)
    byId.set(module.id, module)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: RendererModule[] = []
  const visit = (id: string, path: readonly string[]): void => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`Renderer module dependency cycle: ${[...path, id].join(' -> ')}`)
    const module = byId.get(id)
    if (!module) throw new Error(`Renderer module dependency is missing: ${id}`)
    visiting.add(id)
    for (const dependency of module.requires ?? []) visit(dependency, [...path, id])
    visiting.delete(id)
    visited.add(id)
    ordered.push(module)
  }
  for (const module of modules) visit(module.id, [])
  return ordered
}

async function runCleanups(cleanups: Array<() => void | Promise<void>>): Promise<void> {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
}
