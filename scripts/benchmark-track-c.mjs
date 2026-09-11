import { performance } from 'node:perf_hooks'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Frustum } from '@sekai64-internal/math'
import { Mesh, Scene } from '@sekai64-internal/scene'
import { ClusteredLightGrid, RenderQueueBuilder, resolveOptimization } from '@sekai64-internal/renderer'
import { SpatialMeshIndex } from '@sekai64-internal/large-scene'

const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)] ?? 0
const p95 = values => [...values].sort((a,b)=>a-b)[Math.max(0, Math.ceil(values.length*0.95)-1)] ?? 0
function measure(label, iterations, fn) {
  const values=[]
  for(let i=0;i<iterations;i++){const start=performance.now();fn();values.push(performance.now()-start)}
  return { label, iterations, medianMs: median(values), p95Ms:p95(values), minMs:Math.min(...values), maxMs:Math.max(...values) }
}

const geometry=new BoxGeometry()
const materials=Array.from({length:8},(_,i)=>new BasicMaterial({baseColor:[i/8,0.5,1-i/8]}))
const scene=new Scene()
for(let i=0;i<10_000;i++){
  const mesh=new Mesh({id:`entity-${i}`,geometry,material:materials[i%materials.length]})
  mesh.position.set((i%100)-50,Math.floor(i/100)%10, -10-Math.floor(i/100))
  scene.add(mesh)
}
const camera=new PerspectiveCamera({fieldOfView:60,aspect:16/9,near:0.1,far:500})
camera.position.set(0,20,20);camera.rotation.x=-0.35
scene.updateWorldMatrix();camera.updateWorldMatrix(true);camera.updateMatrices()
const builder=new RenderQueueBuilder()
const options=resolveOptimization({frustumCulling:true,cachedBounds:true,pipelineSorting:true,hizOcclusion:false})
const spatial=new SpatialMeshIndex()
const frustum=new Frustum().setFromProjectionMatrix(camera.viewProjectionMatrix)
const lights=Array.from({length:512},(_,i)=>({id:`light-${i}`,priority:i<8?1:0,positionRange:[(i%32)-16,5,-10-Math.floor(i/32)*8,30],colorDecay:[1,0.8,0.6,2]}))
const clusters=new ClusteredLightGrid({dimensions:[16,9,24],maxLightsPerCluster:24,maxVisibleLights:256})
const results=[]
results.push(measure('10K initial dirty-transform update',5,()=>{for(const child of scene.children)child.position.x+=0.00001;scene.updateWorldMatrixTracked()}))
results.push(measure('10K clean transform traversal',20,()=>scene.updateWorldMatrixTracked()))
results.push(measure('10K render-queue build + sort',20,()=>builder.build(scene,camera,options,undefined,1080)))
results.push(measure('10K BVH rebuild',5,()=>spatial.rebuild(scene)))
spatial.rebuild(scene)
results.push(measure('10K BVH frustum query',50,()=>spatial.queryFrustum(frustum)))
clusters.build(camera,lights)
results.push(measure('512-light clustered grid cache hit',50,()=>clusters.build(camera,lights)))
let clusterRebuildStep=0
results.push(measure('512-light clustered grid rebuild',20,()=>{
  clusterRebuildStep+=1
  camera.position.x=(clusterRebuildStep%2===0?0:0.025)
  camera.updateWorldMatrix(true)
  camera.updateMatrices()
  clusters.build(camera,lights)
}))
camera.position.x=0
camera.updateWorldMatrix(true)
camera.updateMatrices()

const queue=builder.build(scene,camera,options,undefined,1080)
console.log(JSON.stringify({
  runtime:process.version,
  platform:`${process.platform}-${process.arch}`,
  note:'CPU architecture measurements only. Browser GPU frame time, driver overhead, and device thermals are not represented.',
  fixture:{entities:10_000,materials:8,lights:512,visible:queue.opaque.length+queue.transparent.length,frustumCulled:queue.frustumCulled,bvhNodes:spatial.stats.nodes},
  results,
},null,2))
for(const material of materials)material.dispose();geometry.dispose();scene.dispose()
