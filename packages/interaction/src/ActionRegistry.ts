export type SceneAction = (value: unknown, context: SceneActionContext) => void | Promise<void>
export interface SceneActionContext { readonly objectId?: string; readonly source?: Event }

export class SceneActionRegistry {
  private readonly actions = new Map<string, SceneAction>()
  register(name: string, action: SceneAction): () => void {
    if (!name || this.actions.has(name)) throw new Error(`Scene action is invalid or already registered: ${name}`)
    this.actions.set(name, action)
    return () => this.actions.delete(name)
  }
  has(name: string): boolean { return this.actions.has(name) }
  async execute(name: string, value: unknown, context: SceneActionContext = {}): Promise<void> {
    const action = this.actions.get(name)
    if (!action) throw new Error(`Scene action is not registered: ${name}`)
    await action(value, context)
  }
  clear(): void { this.actions.clear() }
}
