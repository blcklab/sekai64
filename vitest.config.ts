import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@sekai64-internal/assets': alias('./packages/assets/src/index.ts'),
      '@sekai64-internal/buildings': alias('./packages/buildings/src/index.ts'),
      '@sekai64-internal/cameras': alias('./packages/cameras/src/index.ts'),
      '@sekai64-internal/collision': alias('./packages/collision/src/index.ts'),
      '@sekai64-internal/controls': alias('./packages/controls/src/index.ts'),
      '@sekai64-internal/core': alias('./packages/core/src/index.ts'),
      '@sekai64-internal/dynamic-texture': alias('./packages/dynamic-texture/src/index.ts'),
      '@sekai64-internal/geometry': alias('./packages/geometry/src/index.ts'),
      '@sekai64-internal/gltf': alias('./packages/gltf/src/index.ts'),
      '@sekai64-internal/interaction': alias('./packages/interaction/src/index.ts'),
      '@sekai64-internal/lighting': alias('./packages/lighting/src/index.ts'),
      '@sekai64-internal/materials': alias('./packages/materials/src/index.ts'),
      '@sekai64-internal/math': alias('./packages/math/src/index.ts'),
      '@sekai64-internal/postprocessing': alias('./packages/postprocessing/src/index.ts'),
      '@sekai64-internal/renderer': alias('./packages/renderer/src/index.ts'),
      '@sekai64-internal/renderer-webgl2': alias('./packages/renderer-webgl2/src/index.ts'),
      '@sekai64-internal/renderer-webgpu': alias('./packages/renderer-webgpu/src/index.ts'),
      '@sekai64-internal/scene': alias('./packages/scene/src/index.ts'),
      '@sekai64-internal/xr': alias('./packages/xr/src/index.ts'),
      '@blcklab/sekai64': alias('./packages/sekai64/src/index.ts'),
      '@blcklab/sekai64/assets': alias('./packages/assets/src/index.ts'),
      '@blcklab/sekai64/buildings': alias('./packages/buildings/src/index.ts'),
      '@blcklab/sekai64/cameras': alias('./packages/cameras/src/index.ts'),
      '@blcklab/sekai64/collision': alias('./packages/collision/src/index.ts'),
      '@blcklab/sekai64/controls': alias('./packages/controls/src/index.ts'),
      '@blcklab/sekai64/core': alias('./packages/core/src/index.ts'),
      '@blcklab/sekai64/dynamic-texture': alias('./packages/dynamic-texture/src/index.ts'),
      '@blcklab/sekai64/geometry': alias('./packages/geometry/src/index.ts'),
      '@blcklab/sekai64/gltf': alias('./packages/gltf/src/index.ts'),
      '@blcklab/sekai64/interaction': alias('./packages/interaction/src/index.ts'),
      '@blcklab/sekai64/lighting': alias('./packages/lighting/src/index.ts'),
      '@blcklab/sekai64/materials': alias('./packages/materials/src/index.ts'),
      '@blcklab/sekai64/math': alias('./packages/math/src/index.ts'),
      '@blcklab/sekai64/postprocessing': alias('./packages/postprocessing/src/index.ts'),
      '@blcklab/sekai64/renderer': alias('./packages/renderer/src/index.ts'),
      '@blcklab/sekai64/renderers/webgl2': alias('./packages/renderer-webgl2/src/index.ts'),
      '@blcklab/sekai64/renderers/webgpu': alias('./packages/renderer-webgpu/src/index.ts'),
      '@blcklab/sekai64/scene': alias('./packages/scene/src/index.ts'),
      '@blcklab/sekai64/xr': alias('./packages/xr/src/index.ts'),
    }
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] }
  }
})
