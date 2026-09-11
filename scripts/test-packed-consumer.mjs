import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNode, runNpm, runTypeScript } from './tool-process.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(join(tmpdir(), 'sekai64-consumer-'))
const publicPackage = JSON.parse(await readFile(join(root, 'packages', 'sekai64', 'package.json'), 'utf8'))

try {
  const pack = await runNpm(['pack', '--workspace', '@blcklab/sekai64', '--json', '--pack-destination', temporary], { cwd: root, maxBuffer: 8 * 1024 * 1024 })
  const result = JSON.parse(pack.stdout)
  const filename = result[0]?.filename
  if (!filename) throw new Error('npm pack did not return a package filename.')
  const tarball = join(temporary, filename)
  const adapterTarballs = []
  for (const directory of ['draco', 'meshopt', 'ktx2']) {
    const adapterPack = await runNpm(['pack', '--json', '--pack-destination', temporary], { cwd: join(root, 'optional-adapters', directory), maxBuffer: 8 * 1024 * 1024 })
    const adapterResult = JSON.parse(adapterPack.stdout)
    const adapterFilename = adapterResult[0]?.filename
    if (!adapterFilename) throw new Error(`npm pack did not return a filename for ${directory}.`)
    adapterTarballs.push(join(temporary, adapterFilename))
  }

  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'sekai64-consumer-test', private: true, type: 'module' }, null, 2))
  await runNpm(['install', tarball, ...adapterTarballs, '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temporary, maxBuffer: 8 * 1024 * 1024 })

  await writeFile(join(temporary, 'runtime.mjs'), `
import assert from 'node:assert/strict'
import { BoxGeometry, CylinderGeometry, ImageMesh, Mesh, PointLight, Scene, SEKAI64_VERSION, StandardMaterial, TextMesh, Texture, Vector3, collectSceneLights } from '@blcklab/sekai64'
import { createBuilding } from '@blcklab/sekai64/buildings'
import { Raycaster } from '@blcklab/sekai64/interaction'
import { createRendererFeatures } from '@blcklab/sekai64/renderer'
import { createDynamicTextureCapability } from '@blcklab/sekai64/dynamic-texture'
import { FirstPersonControls } from '@blcklab/sekai64/controls'
import { loadModel } from '@blcklab/sekai64/gltf'
import { WebGL2Renderer } from '@blcklab/sekai64/renderers/webgl2'
import { WebGPURenderer } from '@blcklab/sekai64/renderers/webgpu'
import { XRSessionManager } from '@blcklab/sekai64/xr'
import { RendererModuleHost } from '@blcklab/sekai64/modules'
import { AnimationClip, AnimationMixer, AnimationTrack } from '@blcklab/sekai64/animation'
import { DecoderRegistry } from '@blcklab/sekai64/decoders'
import { AssetTaskScheduler } from '@blcklab/sekai64/streaming'
import { EnvironmentResource } from '@blcklab/sekai64/environment'
import { ShadowBudgetManager } from '@blcklab/sekai64/large-scene'
import { RendererRecoveryModule } from '@blcklab/sekai64/recovery'
import { createDracoAdapter } from '@blcklab/sekai64-draco'
import { createMeshoptAdapter } from '@blcklab/sekai64-meshopt'
import { createKtx2Adapter } from '@blcklab/sekai64-ktx2'
import schema from '@blcklab/sekai64/schemas/scene-v2.json' with { type: 'json' }
assert.equal(SEKAI64_VERSION, ${JSON.stringify(publicPackage.version)})
assert.equal(schema.$id, 'https://sekai64.dev/schemas/scene-v2.json')
assert.equal(typeof FirstPersonControls, 'function')
assert.equal(typeof loadModel, 'function')
assert.equal(typeof WebGL2Renderer, 'function')
assert.equal(typeof WebGPURenderer, 'function')
assert.equal(typeof XRSessionManager, 'function')
for (const value of [RendererModuleHost, AnimationClip, AnimationMixer, AnimationTrack, DecoderRegistry, AssetTaskScheduler, EnvironmentResource, ShadowBudgetManager, RendererRecoveryModule, createDracoAdapter, createMeshoptAdapter, createKtx2Adapter]) assert.equal(typeof value, 'function')
assert.ok(new CylinderGeometry({ radialSegments: 8 }).triangleCount > 0)
assert.equal(createRendererFeatures().trianglePicking, true)
class Context { font=''; fillStyle=''; textBaseline='middle'; textAlign='center'; measureText(v){return {width:String(v).length*12}} scale(){} clearRect(){} fillRect(){} fillText(){} }
class Canvas { constructor(width,height){this.width=width;this.height=height;this.context=new Context()} getContext(type){return type==='2d'?this.context:null} }
globalThis.OffscreenCanvas=Canvas
const dynamicCapability=createDynamicTextureCapability({backend:'webgl2',disposed:false,capabilities:{backend:'webgl2',maxTextureSize:4096,maxPointLights:8,maxSpotLights:4,computeShaders:false,timestampQueries:false,instancing:true,offscreenCanvas:true,features:createRendererFeatures(),advanced:{maxJoints:0,maxMorphTargets:0,shaderVariants:['static']}}})
const dynamicFrame=dynamicCapability.create({width:160,height:144,label:'packed-frame'})
assert.equal(dynamicFrame.width,160);dynamicFrame.update(new Canvas(160,144));assert.equal(dynamicFrame.version,2);dynamicFrame.dispose();assert.equal(dynamicFrame.disposed,true)
const texture=new Texture({source:new Canvas(64,64)})
const material=new StandardMaterial({baseColorTexture:texture})
const image=new ImageMesh(new Canvas(100,50),{worldWidth:2})
await image.setSource(new Canvas(50,100))
const light=new PointLight({id:'light'});light.position.x=1
const scene=new Scene().add(new TextMesh('Sekai64'),image,light,new Mesh({geometry:new BoxGeometry(),material,ownsResources:true}),createBuilding({width:4,depth:4}))
scene.updateWorldMatrix();assert.equal(texture.ready,true);assert.equal(collectSceneLights(scene,1,new Vector3()).selectedPointCount,1);assert.equal(new Raycaster().intersectScene(scene,{precision:'bounds'}).length>0,true);scene.dispose()
console.log('Packed consumer runtime passed.')
`)
  await runNode(['runtime.mjs'], { cwd: temporary })

  await writeFile(join(temporary, 'consumer.ts'), `
import { CylinderGeometry, ImageMesh, StandardMaterial, TextMesh, createEngine } from '@blcklab/sekai64'
import { createBuilding } from '@blcklab/sekai64/buildings'
import { Raycaster } from '@blcklab/sekai64/interaction'
import { createRendererFeatures } from '@blcklab/sekai64/renderer'
import { createDynamicTextureCapability, type DynamicTexture } from '@blcklab/sekai64/dynamic-texture'
import { loadModel } from '@blcklab/sekai64/gltf'
import type { XRSessionManager } from '@blcklab/sekai64/xr'
import { RendererModuleHost } from '@blcklab/sekai64/modules'
import { AnimationRendererModule } from '@blcklab/sekai64/animation'
import { DecoderRegistry } from '@blcklab/sekai64/decoders'
import { AssetTaskScheduler } from '@blcklab/sekai64/streaming'
import { EnvironmentResource } from '@blcklab/sekai64/environment'
import { ShadowBudgetManager } from '@blcklab/sekai64/large-scene'
import { RendererRecoveryModule } from '@blcklab/sekai64/recovery'
import { createDracoAdapter } from '@blcklab/sekai64-draco'
import { createMeshoptAdapter } from '@blcklab/sekai64-meshopt'
import { createKtx2Adapter } from '@blcklab/sekai64-ktx2'
const material = new StandardMaterial({ baseColorTexture: '/texture.webp' })
const title = new TextMesh('Typed')
const image = new ImageMesh('/image.webp', { autoload: false })
const cylinder = new CylinderGeometry({ radialSegments: 16 })
const building = createBuilding({ width: 10, depth: 12 })
void material.ready; void title; void image.setSource; void cylinder; void building; void loadModel; void createEngine
const fakeRenderer = { backend: 'webgl2' as const, disposed: false, capabilities: { backend: 'webgl2' as const, maxTextureSize: 4096, maxPointLights: 8, maxSpotLights: 4, computeShaders: false, timestampQueries: false, instancing: true, offscreenCanvas: true, features: createRendererFeatures(), advanced: { maxJoints: 0, maxMorphTargets: 0, shaderVariants: ['static'] as const } } }
const dynamic: DynamicTexture = createDynamicTextureCapability(fakeRenderer).create({ source: new OffscreenCanvas(16, 16) })
void dynamic.texture
dynamic.dispose()
const xr: XRSessionManager | undefined = undefined; void xr
void RendererModuleHost; void AnimationRendererModule; void DecoderRegistry; void AssetTaskScheduler; void EnvironmentResource; void ShadowBudgetManager; void RendererRecoveryModule; void createDracoAdapter; void createMeshoptAdapter; void createKtx2Adapter
`)
  await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM', 'DOM.Iterable'], strict: true, noEmit: true, skipLibCheck: false }, include: ['consumer.ts'] }, null, 2))
  await runTypeScript(root, ['-p', 'tsconfig.json', '--pretty', 'false'], { cwd: temporary })

  const installed = JSON.parse(await readFile(join(temporary, 'node_modules', '@blcklab', 'sekai64', 'package.json'), 'utf8'))
  if (Object.keys(installed.dependencies ?? {}).length > 0) throw new Error('Packed package unexpectedly contains runtime dependencies.')
  console.log(`Verified packed external consumer for @blcklab/sekai64@${installed.version}.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
