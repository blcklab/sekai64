import type { RendererModule, RendererModuleContext, RendererModuleInstance } from '@sekai64-internal/modules'
import type { Mesh, Node } from '@sekai64-internal/scene'
import { AnimationClip } from './AnimationClip.js'
import { AnimationMixer } from './AnimationMixer.js'
import { SkeletonResource } from './Skeleton.js'
import { SkinnedGeometry } from './SkinnedGeometry.js'
import { SEKAI64_MODULE_VERSION } from '@sekai64-internal/modules'

interface SkinBinding { mesh: Mesh; skeleton?: SkeletonResource }
export interface AnimationRendererModuleOptions {
  maxJoints?: number
  maxMorphTargets?: number
  deformation?: 'auto' | 'cpu-dynamic-geometry'
}

export class AnimationRendererModule implements RendererModule {
  readonly id = 'sekai64.animation'
  readonly version = SEKAI64_MODULE_VERSION
  readonly mixers = new Set<AnimationMixer>()
  readonly bindings = new Set<SkinBinding>()
  private installed = false
  private disposed = false
  private context?: RendererModuleContext

  constructor(readonly options: AnimationRendererModuleOptions = {}) {}

  setup(context: RendererModuleContext): RendererModuleInstance {
    if (this.installed) throw new Error('AnimationRendererModule is already installed.')
    if (this.disposed) throw new Error('AnimationRendererModule is disposed.')
    this.installed = true
    this.context = context
    const maxJoints = Math.max(1, Math.floor(this.options.maxJoints ?? (context.renderer.backend === 'webgpu' ? 256 : 128)))
    const maxMorphTargets = Math.max(1, Math.floor(this.options.maxMorphTargets ?? 16))
    return {
      capabilities: {
        skinning: true,
        morphTargets: true,
        clipSampling: true,
        mixers: true,
        crossFades: true,
        maxJoints,
        maxMorphTargets,
        deformation: 'cpu-dynamic-geometry',
        shaderVariants: Object.freeze(['static', 'skinned', 'morph', 'skinned-morph']),
      },
      update: frame => this.update(frame.deltaTime),
      recover: () => { for (const binding of this.bindings) binding.mesh.geometry.markUpdated(false) },
      dispose: () => this.dispose(),
    }
  }

  createMixer(root: Node, clips: readonly AnimationClip[] = []): AnimationMixer {
    this.assertAlive()
    const mixer = new AnimationMixer(root, clips)
    this.mixers.add(mixer)
    return mixer
  }

  removeMixer(mixer: AnimationMixer): void { this.mixers.delete(mixer) }

  bind(mesh: Mesh, skeleton?: SkeletonResource): () => void {
    this.assertAlive()
    if (!(mesh.geometry instanceof SkinnedGeometry)) throw new Error('Animation module bindings require SkinnedGeometry.')
    if (skeleton && skeleton.joints.length > (this.options.maxJoints ?? (this.context?.renderer.backend === 'webgpu' ? 256 : 128))) {
      throw new Error(`Skeleton ${skeleton.id} exceeds the configured joint limit.`)
    }
    const binding = { mesh, ...(skeleton ? { skeleton } : {}) }
    this.bindings.add(binding)
    return () => this.bindings.delete(binding)
  }

  update(deltaTime: number): void {
    this.assertAlive()
    for (const mixer of this.mixers) mixer.update(deltaTime)
    for (const binding of this.bindings) {
      if (binding.mesh.disposed || binding.mesh.geometry.disposed || binding.skeleton?.disposed) { this.bindings.delete(binding); continue }
      binding.mesh.updateWorldFromRoot()
      ;(binding.mesh.geometry as SkinnedGeometry).deform(binding.skeleton, binding.mesh.worldMatrix)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const mixer of this.mixers) { mixer.stopAll(); mixer.clearListeners() }
    this.mixers.clear()
    this.bindings.clear()
    this.context = undefined
  }

  private assertAlive(): void { if (this.disposed) throw new Error('AnimationRendererModule is disposed.') }
}

export function createAnimationRendererModule(options: AnimationRendererModuleOptions = {}): AnimationRendererModule {
  return new AnimationRendererModule(options)
}
