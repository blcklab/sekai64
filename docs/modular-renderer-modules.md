# Renderer modules

Pass optional modules to `createEngine()` to enable them. Importing a module alone does not change the engine.

```ts
import { createEngine } from '@blcklab/sekai64'
import { createAnimationRendererModule } from '@blcklab/sekai64/animation'
import { createRendererRecoveryModule } from '@blcklab/sekai64/recovery'

const animation = createAnimationRendererModule()
const recovery = createRendererRecoveryModule()

const engine = await createEngine({
  canvas: '#app',
  modules: [animation, recovery]
})
```

Dependencies are set up first. Duplicate module IDs, missing dependencies, and dependency cycles stop setup with an error.

The module host reports each module's capabilities separately from `engine.capabilities`. Check the module when you need to know whether an optional feature is installed.

When shutting down, await cleanup:

```ts
await engine.disposeAsync()
```

Modules are disposed in reverse setup order. See [animation](animation-and-animated-gltf.md) and [recovery](environment-large-scene-recovery.md#recovery) for examples of using the installed modules.
