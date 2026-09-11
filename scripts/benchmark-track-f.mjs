import { performance } from 'node:perf_hooks'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { BoxGeometry } from '@sekai64-internal/geometry'
import { BasicMaterial } from '@sekai64-internal/materials'
import { Frustum } from '@sekai64-internal/math'
import { Mesh, Scene } from '@sekai64-internal/scene'
import { ClusteredLightGrid, RenderQueueBuilder, resolveOptimization } from '@sekai64-internal/renderer'
import { SpatialMeshIndex } from '@sekai64-internal/large-scene'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]??0
function measure(name,iterations,fn){const values=[];let details;for(let i=0;i<iterations+2;i++){const start=performance.now();details=fn();const ms=performance.now()-start;if(i>=2)values.push(ms)}return{name,iterations,medianMs:percentile(values,.5),p95Ms:percentile(values,.95),details}}
const geometry=new BoxGeometry();const materials=Array.from({length:8},(_,i)=>new BasicMaterial({baseColor:[i/8,.5,1-i/8]}));const scene=new Scene()
for(let i=0;i<10_000;i++){const mesh=new Mesh({id:`e-${i}`,geometry,material:materials[i%8]});mesh.position.set((i%100)-50,Math.floor(i/100)%10,-10-Math.floor(i/100));scene.add(mesh)}
const camera=new PerspectiveCamera({fieldOfView:60,aspect:16/9,near:.1,far:600});camera.position.set(0,20,20);camera.rotation.x=-.35;scene.updateWorldMatrixTracked();camera.updateWorldMatrix(true);camera.updateMatrices()
const builder=new RenderQueueBuilder();const options=resolveOptimization({frustumCulling:true,cachedBounds:true,pipelineSorting:true,hizOcclusion:false});const spatial=new SpatialMeshIndex();const frustum=new Frustum().setFromProjectionMatrix(camera.viewProjectionMatrix);const lights=Array.from({length:512},(_,i)=>({id:`l-${i}`,priority:i<8?2:0,positionRange:[(i%32)-16,5,-10-Math.floor(i/32)*8,30],colorDecay:[1,.8,.6,2]}));const clusters=new ClusteredLightGrid({dimensions:[16,9,24],maxLightsPerCluster:24,maxVisibleLights:256})
const results=[measure('dirty transforms',5,()=>{for(const child of scene.children)child.position.x+=.000001;return scene.updateWorldMatrixTracked()}),measure('clean transform traversal',20,()=>scene.updateWorldMatrixTracked()),measure('render queue build and sort',20,()=>{const q=builder.build(scene,camera,options,undefined,1080);return{visible:q.opaque.length+q.transparent.length,culled:q.frustumCulled,allocations:q.itemAllocations}}),measure('BVH rebuild',5,()=>{spatial.rebuild(scene);return spatial.stats}),measure('BVH frustum query',30,()=>({visible:spatial.queryFrustum(frustum).length})),measure('512-light cluster rebuild',10,()=>{camera.position.x+=.001;camera.updateWorldMatrix(true);camera.updateMatrices();clusters.build(camera,lights);return clusters.stats})]
const report={format:'@blcklab/sekai64/track-f-benchmark',schemaVersion:1,generatedAt:new Date().toISOString(),environment:{node:process.version,platform:`${process.platform}-${process.arch}`,cpu:os.cpus()[0]?.model??'unknown'},fixture:{entities:10_000,materials:8,lights:512},results,disclaimer:'CPU architecture measurements only. Real browser, GPU, driver, mobile and thermal evidence is separate.'}
await writeFile(path.join(root,'track-f-benchmark-results.json'),`${JSON.stringify(report,null,2)}\n`);console.table(results.map(item=>({operation:item.name,medianMs:item.medianMs.toFixed(3),p95Ms:item.p95Ms.toFixed(3)})));for(const m of materials)m.dispose();geometry.dispose();scene.dispose()
