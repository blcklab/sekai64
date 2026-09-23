# Animation and animated glTF

The optional animation subpath provides skeleton resources, morph targets, clip sampling, mixers, markers, loop modes, seeking, blend weights, and crossfades.

```ts
import {
  createAnimationRendererModule,
  createGltfAnimationAdapter,
} from '@blcklab/sekai64/animation'
import { loadModel } from '@blcklab/sekai64/gltf'

const animation = createAnimationRendererModule()
const engine = await createEngine({ canvas, modules: [animation] })
const asset = await loadModel('/character.glb', {
  animation: createGltfAnimationAdapter(animation),
})

const set = asset.getExtension('sekai64.animation.gltf')
set?.mixer?.play(set.clips[0], { loop: 'repeat' })
```

Without the adapter, animated input produces `SEKAI64_GLTF_ANIMATION_MODULE_REQUIRED` unless `animatedFallback: 'static-pose'` is selected explicitly.

The RC.10 deformation implementation is correctness-first dynamic geometry shared by WebGL2 and WebGPU. It avoids adding animation shader payload to static consumers. Native GPU skinning is a future performance optimization.
