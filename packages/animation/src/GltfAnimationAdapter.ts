import type {
  GltfAnimationAdapter,
  GltfAnimationFinalizeContext,
  GltfPrimitiveAnimationData,
  GltfRuntimeExtension,
} from '@sekai64-internal/gltf'
import { Mesh } from '@sekai64-internal/scene'
import { AnimationClip, AnimationTrack } from './AnimationClip.js'
import type { AnimationMixer } from './AnimationMixer.js'
import { AnimationRendererModule } from './AnimationRendererModule.js'
import { SkeletonResource } from './Skeleton.js'
import { SkinnedGeometry } from './SkinnedGeometry.js'

export const GLTF_ANIMATION_EXTENSION_ID = 'sekai64.animation.gltf'
export interface GltfAnimationSet {
  readonly clips: readonly AnimationClip[]
  readonly skeletons: readonly SkeletonResource[]
  readonly mixer?: AnimationMixer
}
export interface GltfAnimationAdapterOptions { createMixer?: boolean }
interface PendingBinding { mesh: Mesh; data: GltfPrimitiveAnimationData }

export function createGltfAnimationAdapter(
  module: AnimationRendererModule,
  options: GltfAnimationAdapterOptions = {},
): GltfAnimationAdapter {
  const bindings: PendingBinding[] = []
  return {
    id: GLTF_ANIMATION_EXTENSION_ID,
    createGeometry(data) {
      const geometry = new SkinnedGeometry({
        ...data.base,
        ...(data.jointIndices ? { jointIndices: Uint16Array.from(data.jointIndices, value => Math.max(0, Math.floor(value))) } : {}),
        ...(data.jointWeights ? { jointWeights: data.jointWeights } : {}),
        morphTargets: data.morphTargets,
      }, `${data.id}:animated-geometry`)
      geometry.setMorphWeights(data.defaultWeights)
      return geometry
    },
    bindMesh(mesh, data) { bindings.push({ mesh, data }) },
    finalize(context) {
      const skeletons = createSkeletons(context)
      for (const binding of bindings.splice(0)) {
        const skeleton = binding.data.skinIndex === undefined ? undefined : skeletons[binding.data.skinIndex]
        module.bind(binding.mesh, skeleton)
      }
      const clips = createClips(context)
      const mixer = options.createMixer === false || clips.length === 0 ? undefined : module.createMixer(context.scene, clips)
      const value: GltfAnimationSet = Object.freeze({ clips, skeletons, ...(mixer ? { mixer } : {}) })
      return {
        id: GLTF_ANIMATION_EXTENSION_ID,
        value,
        dispose: () => {
          if (mixer) { module.removeMixer(mixer); mixer.stopAll(); mixer.clearListeners() }
          for (const skeleton of skeletons) skeleton.dispose()
          for (const clip of clips) clip.dispose()
        },
      } satisfies GltfRuntimeExtension<GltfAnimationSet>
    },
  }
}

function createSkeletons(context: GltfAnimationFinalizeContext): SkeletonResource[] {
  return (context.document.skins ?? []).map((skin, index) => {
    const joints = skin.joints.map(jointIndex => {
      const node = context.nodes.get(jointIndex)?.[0]
      if (!node) throw new Error(`glTF skin ${index} references missing joint node ${jointIndex}.`)
      return node
    })
    const inverseBindMatrices = skin.inverseBindMatrices === undefined ? undefined : context.readAccessor(skin.inverseBindMatrices)
    return new SkeletonResource({ id: `gltf-skin-${index}`, label: skin.name, joints, ...(inverseBindMatrices ? { inverseBindMatrices } : {}) })
  })
}

function createClips(context: GltfAnimationFinalizeContext): AnimationClip[] {
  return (context.document.animations ?? []).map((animation, animationIndex) => {
    const tracks = animation.channels.map((channel, channelIndex) => {
      const sampler = animation.samplers[channel.sampler]
      if (!sampler) throw new Error(`glTF animation ${animationIndex} channel ${channelIndex} references missing sampler ${channel.sampler}.`)
      if (sampler.interpolation === 'CUBICSPLINE') throw new Error('SEKAI64_GLTF_CUBICSPLINE_UNSUPPORTED: Cubic-spline animation interpolation is not supported yet.')
      const targetIndex = channel.target.node
      if (targetIndex === undefined) throw new Error(`glTF animation ${animationIndex} channel ${channelIndex} has no target node.`)
      const target = context.nodes.get(targetIndex)?.[0]
      if (!target) throw new Error(`glTF animation ${animationIndex} targets missing node ${targetIndex}.`)
      const path = channel.target.path
      if (!['translation', 'rotation', 'scale', 'weights'].includes(path)) throw new Error(`Unsupported glTF animation path: ${path}`)
      const times = context.readAccessor(sampler.input)
      const values = context.readAccessor(sampler.output)
      const valueSize = path === 'rotation' ? 4 : path === 'weights' ? values.length / times.length : 3
      return new AnimationTrack({
        target: target.id || target.name || `gltf-node-${targetIndex}`,
        path: path as 'translation' | 'rotation' | 'scale' | 'weights',
        times,
        values,
        interpolation: sampler.interpolation === 'STEP' ? 'step' : 'linear',
        valueSize,
      })
    })
    return new AnimationClip({ id: `gltf-animation-${animationIndex}`, name: animation.name, tracks })
  })
}
