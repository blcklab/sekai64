# Animation and animated glTF

To play a model's animations, install the animation module and pass its adapter to the glTF loader.

```ts
import { AmbientLight, createEngine, PerspectiveCamera, Scene } from '@blcklab/sekai64'
import {
  createAnimationRendererModule,
  createGltfAnimationAdapter,
  GLTF_ANIMATION_EXTENSION_ID,
  type GltfAnimationSet
} from '@blcklab/sekai64/animation'
import { loadModel } from '@blcklab/sekai64/gltf'

const animation = createAnimationRendererModule()
const engine = await createEngine({ canvas: '#app', modules: [animation] })
const scene = new Scene()
scene.add(new AmbientLight())
const camera = new PerspectiveCamera()
camera.position.set(0, 1.5, 4)
camera.lookAt([0, 1, 0])

const model = await loadModel('/character.glb', {
  animation: createGltfAnimationAdapter(animation)
})
scene.add(model)

const set = model.asset.getExtension<GltfAnimationSet>(GLTF_ANIMATION_EXTENSION_ID)
const clip = set?.clips[0]
if (clip) set?.mixer?.play(clip, { loop: 'repeat' })

engine.start(() => engine.render(scene, camera))
```

`engine.start()` advances installed modules before your frame callback. If you run your own frame loop, call `animation.update(deltaTime)` with elapsed seconds before rendering.

## Loading a static pose

Without the adapter, animated assets fail with `SEKAI64_GLTF_ANIMATION_MODULE_REQUIRED`. If you only need a still model, opt in to the fallback:

```ts
const model = await loadModel('/character.glb', {
  animatedFallback: 'static-pose'
})
```

## Playback and limits

The module supports skeletons, morph targets, clip sampling, seeking, loop modes, blend weights, crossfades, and markers. glTF tracks support translation, rotation, scale, and weights with `LINEAR` or `STEP` interpolation. `CUBICSPLINE` is not supported.

Skinning and morph deformation run on the CPU, then upload geometry updates to WebGL2 or WebGPU. Factor that cost into scenes with many animated characters. Animation graphs, additive layers, and root-motion rules belong in your app.

When removing the model, call `model.dispose()` to release its animation clips, skeletons, and model resources. Await `engine.disposeAsync()` when shutting down the engine.
