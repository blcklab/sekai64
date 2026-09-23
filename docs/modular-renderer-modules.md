# Modular renderer features

Sekai64 0.8 uses explicit module installation. Importing a subpath has no global side effect.

```ts
import { createEngine } from '@blcklab/sekai64'
import { createAnimationRendererModule } from '@blcklab/sekai64/animation'
import { createRendererRecoveryModule } from '@blcklab/sekai64/recovery'

const animation = createAnimationRendererModule()
const recovery = createRendererRecoveryModule()

const engine = await createEngine({
  canvas,
  modules: [animation, recovery],
})
```

Module dependencies are ordered before setup. Duplicate IDs, missing dependencies, and dependency cycles fail deterministically. Disposal runs in reverse order and awaits module cleanup.

The module host exposes per-module capabilities separately from the renderer's core capability object.
