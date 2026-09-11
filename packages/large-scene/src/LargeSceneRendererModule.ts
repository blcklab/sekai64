import type { RendererModule, RendererModuleInstance } from '@sekai64-internal/modules'
import { SpatialMeshIndex } from './SpatialMeshIndex.js'
import { SEKAI64_MODULE_VERSION } from '@sekai64-internal/modules'
export class LargeSceneRendererModule implements RendererModule { readonly id = 'sekai64.large-scene'; readonly version = SEKAI64_MODULE_VERSION; readonly index = new SpatialMeshIndex(); setup(): RendererModuleInstance { return { capabilities: { shadowBudgets: true, spatialPicking: true, lazyAcceleration: true }, dispose: () => this.index.clear() } } }
export function createLargeSceneRendererModule(): LargeSceneRendererModule { return new LargeSceneRendererModule() }
