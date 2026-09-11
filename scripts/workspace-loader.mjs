import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const privatePackages = new Map([
  ['@sekai64-internal/animation', 'animation'],
  ['@sekai64-internal/decoders', 'decoders'],
  ['@sekai64-internal/environment', 'environment'],
  ['@sekai64-internal/environment-authoring', 'environment-authoring'],
  ['@sekai64-internal/large-scene', 'large-scene'],
  ['@sekai64-internal/modules', 'modules'],
  ['@sekai64-internal/recovery', 'recovery'],
  ['@sekai64-internal/streaming', 'streaming'],
  ['@sekai64-internal/texture-tools', 'texture-tools'],
  ['@sekai64-internal/assets', 'assets'],
  ['@sekai64-internal/buildings', 'buildings'],
  ['@sekai64-internal/cameras', 'cameras'],
  ['@sekai64-internal/collision', 'collision'],
  ['@sekai64-internal/controls', 'controls'],
  ['@sekai64-internal/core', 'core'],
  ['@sekai64-internal/dynamic-texture', 'dynamic-texture'],
  ['@sekai64-internal/geometry', 'geometry'],
  ['@sekai64-internal/gltf', 'gltf'],
  ['@sekai64-internal/interaction', 'interaction'],
  ['@sekai64-internal/lighting', 'lighting'],
  ['@sekai64-internal/materials', 'materials'],
  ['@sekai64-internal/math', 'math'],
  ['@sekai64-internal/postprocessing', 'postprocessing'],
  ['@sekai64-internal/renderer', 'renderer'],
  ['@sekai64-internal/renderer-webgl2', 'renderer-webgl2'],
  ['@sekai64-internal/renderer-webgpu', 'renderer-webgpu'],
  ['@sekai64-internal/scene', 'scene'],
  ['@sekai64-internal/xr', 'xr'],
])

const standalonePackages = new Map([
  ['@blcklab/sekai64-draco', 'draco'],
  ['@blcklab/sekai64-meshopt', 'meshopt'],
  ['@blcklab/sekai64-ktx2', 'ktx2'],
])

const publicAliases = new Map([
  ['@blcklab/sekai64/animation', 'animation'],
  ['@blcklab/sekai64/decoders', 'decoders'],
  ['@blcklab/sekai64/environment', 'environment'],
  ['@blcklab/sekai64/environment-authoring', 'environment-authoring'],
  ['@blcklab/sekai64/large-scene', 'large-scene'],
  ['@blcklab/sekai64/modules', 'modules'],
  ['@blcklab/sekai64/recovery', 'recovery'],
  ['@blcklab/sekai64/streaming', 'streaming'],
  ['@blcklab/sekai64/texture-tools', 'texture-tools'],
  ['@blcklab/sekai64/assets', 'assets'],
  ['@blcklab/sekai64/buildings', 'buildings'],
  ['@blcklab/sekai64/cameras', 'cameras'],
  ['@blcklab/sekai64/collision', 'collision'],
  ['@blcklab/sekai64/controls', 'controls'],
  ['@blcklab/sekai64/core', 'core'],
  ['@blcklab/sekai64/dynamic-texture', 'dynamic-texture'],
  ['@blcklab/sekai64/geometry', 'geometry'],
  ['@blcklab/sekai64/gltf', 'gltf'],
  ['@blcklab/sekai64/interaction', 'interaction'],
  ['@blcklab/sekai64/lighting', 'lighting'],
  ['@blcklab/sekai64/materials', 'materials'],
  ['@blcklab/sekai64/math', 'math'],
  ['@blcklab/sekai64/postprocessing', 'postprocessing'],
  ['@blcklab/sekai64/renderer', 'renderer'],
  ['@blcklab/sekai64/renderers/webgl2', 'renderer-webgl2'],
  ['@blcklab/sekai64/renderers/webgpu', 'renderer-webgpu'],
  ['@blcklab/sekai64/scene', 'scene'],
  ['@blcklab/sekai64/xr', 'xr'],
])

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@blcklab/sekai64') {
    return { url: pathToFileURL(resolvePath('packages/sekai64/dist/index.js')).href, shortCircuit: true }
  }
  if (specifier === '@blcklab/sekai64/geometry/beveled-box') return { url: pathToFileURL(resolvePath('packages/sekai64/dist/geometry/BeveledBoxGeometry.js')).href, shortCircuit: true }
    const standaloneDirectory = standalonePackages.get(specifier)
  if (standaloneDirectory) return { url: pathToFileURL(resolvePath('optional-adapters', standaloneDirectory, 'dist/index.js')).href, shortCircuit: true }
  const privateDirectory = privatePackages.get(specifier)
  if (privateDirectory) return { url: pathToFileURL(resolvePath('packages', privateDirectory, 'dist/index.js')).href, shortCircuit: true }
  const publicDirectory = publicAliases.get(specifier)
  if (publicDirectory) {
    return {
      // Public-package smoke tests must resolve every public subpath from the
      // same assembled graph. Mixing an assembled root with private workspace
      // classes breaks identity-sensitive APIs such as instanceof Mesh.
      url: pathToFileURL(resolvePath('packages', 'sekai64', 'dist', publicDirectory, 'index.js')).href,
      shortCircuit: true
    }
  }
  return nextResolve(specifier, context)
}
