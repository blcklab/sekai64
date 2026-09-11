export type EventListener<T> = (event: T) => void

export class EventDispatcher<TEvents> {
  private readonly listeners = new Map<keyof TEvents, Set<EventListener<unknown>>>()

  on<TKey extends keyof TEvents>(type: TKey, listener: EventListener<TEvents[TKey]>): () => void {
    let group = this.listeners.get(type)
    if (!group) {
      group = new Set()
      this.listeners.set(type, group)
    }
    group.add(listener as EventListener<unknown>)
    return () => this.off(type, listener)
  }

  once<TKey extends keyof TEvents>(type: TKey, listener: EventListener<TEvents[TKey]>): () => void {
    const unsubscribe = this.on(type, event => {
      unsubscribe()
      listener(event)
    })
    return unsubscribe
  }

  off<TKey extends keyof TEvents>(type: TKey, listener: EventListener<TEvents[TKey]>): void {
    const group = this.listeners.get(type)
    group?.delete(listener as EventListener<unknown>)
    if (group?.size === 0) this.listeners.delete(type)
  }

  emit<TKey extends keyof TEvents>(type: TKey, event: TEvents[TKey]): void {
    const group = this.listeners.get(type)
    if (!group) return
    for (const listener of [...group]) listener(event)
  }

  clearListeners(): void {
    this.listeners.clear()
  }
}
