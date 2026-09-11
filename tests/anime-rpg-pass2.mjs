import assert from 'node:assert/strict'
import { PerspectiveCamera } from '@sekai64-internal/cameras'
import { Box3, Vector3 } from '@sekai64-internal/math'
import { ClusteredLightGrid, HierarchicalDepthCuller, TextureResidencyManager, createBloomPyramid, createGtaoKernel } from '@sekai64-internal/renderer'

const kernel=createGtaoKernel(8)
assert.equal(kernel.length,8)
assert.ok(kernel.every(sample=>['x','y','z','weight'].every(key=>Number.isFinite(sample[key]))))
const pyramid=createBloomPyramid(1920,1080,5,0.75)
assert.equal(pyramid.length,5)
assert.ok(pyramid[1].width<pyramid[0].width)
assert.ok(Math.abs(pyramid.reduce((sum,level)=>sum+level.weight,0)-1)<1e-6)

const camera=new PerspectiveCamera({fieldOfView:60,aspect:16/9,near:0.1,far:100})
camera.position.set(0,0,0); camera.updateWorldMatrix(true); camera.updateMatrices()
const bounds=new Box3(new Vector3(-1,-1,-5),new Vector3(1,1,-3))
const hiz=new HierarchicalDepthCuller(64)
hiz.beginFrame(camera,1280,720)
assert.equal(hiz.isOccluded(bounds),false)
hiz.submitOccluder(bounds);hiz.endFrame();assert.ok(hiz.stats.levels>1)

const clusters=new ClusteredLightGrid({dimensions:[8,4,12],maxLightsPerCluster:4})
clusters.build(camera,[
 {positionRange:[0,0,-4,8],colorDecay:[1,1,1,2]},
 {positionRange:[2,1,-10,6],colorDecay:[1,0.8,0.6,2]},
])
assert.equal(clusters.clusterCount,8*4*12)
assert.ok(clusters.assignedLightReferences>0)
assert.ok(clusters.selectForBounds(bounds).length>0)

const evicted=[]
const residency=new TextureResidencyManager(100,2)
const a={},b={}
residency.touch(a,80,0,()=>evicted.push('a'))
residency.touch(b,80,0,()=>evicted.push('b'))
assert.ok(residency.enforce(3)>=1)
assert.ok(evicted.length>=1)
console.log('Sekai64 Anime-RPG pass 2 advanced rendering assertions passed.')
