import { describe, expect, it } from 'vitest'
import { ManagedResource, ResourceScope } from './index.js'

class TestResource extends ManagedResource {
  released = 0
  constructor() { super() }
  protected release(): void {
    this.released += 1
  }
}

describe('ResourceScope', () => {
  it('disposes tracked resources exactly once', () => {
    const scope = new ResourceScope()
    const resource = scope.track(new TestResource())
    scope.dispose()
    scope.dispose()
    expect(resource.disposed).toBe(true)
    expect(resource.released).toBe(1)
  })
})
