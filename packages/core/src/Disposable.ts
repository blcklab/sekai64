export interface Disposable {
  readonly disposed: boolean
  dispose(): void
}

export abstract class ManagedResource implements Disposable {
  readonly label?: string
  disposed = false

  protected constructor(label?: string) {
    this.label = label
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.release()
  }

  protected abstract release(): void

  protected assertAlive(): void {
    if (this.disposed) {
      throw new Error(`${this.constructor.name}${this.label ? ` (${this.label})` : ''} is disposed.`)
    }
  }
}
