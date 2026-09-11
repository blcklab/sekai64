import type { Disposable } from './Disposable.js'

export interface ResourceScopeOptions { label?: string; onDispose?: (scope: ResourceScope) => void }

export class ResourceScope implements Disposable {
  disposed = false
  readonly label?: string
  private readonly resources = new Set<Disposable>()
  private readonly onDispose?: (scope: ResourceScope) => void

  constructor(options: ResourceScopeOptions = {}) { this.label = options.label; this.onDispose = options.onDispose }

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) { resource.dispose(); throw new Error(`Cannot track a resource in disposed ResourceScope${this.label ? ` (${this.label})` : ''}.`) }
    this.resources.add(resource)
    return resource
  }
  release(resource: Disposable): void { this.resources.delete(resource) }
  has(resource: Disposable): boolean { return this.resources.has(resource) }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const resource of [...this.resources].reverse()) resource.dispose(); this.resources.clear(); this.onDispose?.(this) }
  get size(): number { return this.resources.size }
}

export class ResourceManager implements Disposable {
  disposed = false
  private readonly scopes = new Set<ResourceScope>()
  createScope(label?: string): ResourceScope {
    if (this.disposed) throw new Error('ResourceManager is disposed.')
    const scope = new ResourceScope({ label, onDispose: value => this.scopes.delete(value) })
    this.scopes.add(scope)
    return scope
  }
  get stats(): { scopes: number; trackedResources: number } { let trackedResources = 0; for (const scope of this.scopes) trackedResources += scope.size; return { scopes: this.scopes.size, trackedResources } }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const scope of [...this.scopes]) scope.dispose(); this.scopes.clear() }
}
