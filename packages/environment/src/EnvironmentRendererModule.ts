import { EnvironmentLight } from '@sekai64-internal/lighting'
import type { RendererModule, RendererModuleInstance } from '@sekai64-internal/modules'
import type { Scene } from '@sekai64-internal/scene'
import type { EnvironmentResource } from './EnvironmentResource.js'
import { SEKAI64_MODULE_VERSION } from '@sekai64-internal/modules'

export interface EnvironmentPresentation { background?: boolean; intensity?: number }
export class EnvironmentRendererModule implements RendererModule {
  readonly id = 'sekai64.environment'; readonly version = SEKAI64_MODULE_VERSION
  private environment?: EnvironmentResource
  private presentation: Required<EnvironmentPresentation> = { background: true, intensity: 1 }
  private readonly light = new EnvironmentLight({ name: 'Sekai64 environment probe' })
  private renderer?: Parameters<RendererModule['setup']>[0]['renderer']

  setup(context: Parameters<RendererModule['setup']>[0]): RendererModuleInstance {
    this.renderer = context.renderer
    return { capabilities: { hdr: true, imageBasedLighting: 'ambient-probe', toneMapping: true, visibleBackground: true }, beforeRender: scene => this.apply(scene), dispose: () => this.dispose() }
  }
  setEnvironment(environment: EnvironmentResource | undefined, presentation: EnvironmentPresentation = {}): this { this.environment = environment; this.presentation = { background: presentation.background ?? true, intensity: Math.max(0, presentation.intensity ?? 1) }; return this }
  private apply(scene: Scene): void {
    const environment = this.environment
    if (!environment || environment.disposed) { this.light.removeFromParent(); this.renderer?.setEnvironmentMap(undefined); return }
    this.light.color.copy(environment.skyAverage)
    this.light.groundColor.copy(environment.groundAverage)
    this.light.intensity = environment.intensity * this.presentation.intensity
    this.light.specularIntensity = Math.max(0, environment.intensity * 0.45)
    this.light.source = environment.id
    if (this.light.parent !== scene) scene.add(this.light)
    if (this.renderer) {
      this.renderer.setEnvironmentMap({
        width: environment.width,
        height: environment.height,
        pixels: rgbToRgbaFloat(environment.pixels),
        format: 'rgba16f-linear',
        intensity: environment.intensity * this.presentation.intensity,
        label: environment.label ?? environment.id,
      })
      if (this.presentation.background) this.renderer.setClearColor(environment.average)
    }
  }
  dispose(): void { this.light.removeFromParent(); this.renderer?.setEnvironmentMap(undefined); this.renderer = undefined; this.environment = undefined }
}
export function createEnvironmentRendererModule(): EnvironmentRendererModule { return new EnvironmentRendererModule() }

function rgbToRgbaFloat(source: Float32Array): Float32Array {
  const output = new Float32Array((source.length / 3) * 4)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 3, targetIndex += 4) {
    output[targetIndex] = source[sourceIndex] ?? 0
    output[targetIndex + 1] = source[sourceIndex + 1] ?? 0
    output[targetIndex + 2] = source[sourceIndex + 2] ?? 0
    output[targetIndex + 3] = 1
  }
  return output
}
