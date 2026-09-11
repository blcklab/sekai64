import assert from 'node:assert/strict'
import { EnvironmentResource, createEnvironmentRendererModule } from '../dist/environment/index.js'
import { Scene } from '../dist/scene/index.js'

const environment = new EnvironmentResource({
  id: 'hdr-regression', width: 2, height: 2,
  pixels: new Float32Array([
    12, 10, 8, 0.25, 0.3, 0.4,
    0.5, 0.6, 0.7, 2, 1.5, 1,
  ]),
})
let uploaded
const renderer = {
  setEnvironmentMap(value) { uploaded = value },
  setClearColor() {},
}
const module = createEnvironmentRendererModule().setEnvironment(environment)
const instance = module.setup({ renderer })
instance.beforeRender(new Scene())
assert.equal(uploaded?.format, 'rgba16f-linear')
assert.ok(uploaded?.pixels instanceof Float32Array)
assert.equal(uploaded?.pixels[0], 12, 'HDR highlights must survive the environment bridge')
assert.equal(uploaded?.pixels[3], 1)
module.dispose()
environment.dispose()

console.log('Sekai64 RC.27 GLB viewer-parity HDR bridge checks passed.')
