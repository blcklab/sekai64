import test from 'node:test'
import assert from 'node:assert/strict'
import { SphereGeometry, BoxGeometry } from '../dist/geometry/index.js'
import { PerspectiveCamera } from '../dist/cameras/index.js'
import { BasicMaterial } from '../dist/materials/index.js'
import { Mesh, Scene } from '../dist/scene/index.js'
import { RenderQueueBuilder } from '../dist/renderer/index.js'
import { WebGPURenderer } from '../dist/renderer-webgpu/index.js'
test('sphere has finite normals, outward winding and 16/32-bit indices',()=>{
 const g=new SphereGeometry({radius:2,widthSegments:12,heightSegments:8});assert.ok(g.indices instanceof Uint16Array);assert.equal(g.triangleCount,168);assert.equal(g.uvs.length,g.positions.length/3*2)
 for(let i=0;i<g.positions.length;i+=3){assert.ok(Math.abs(Math.hypot(...g.positions.slice(i,i+3))-2)<1e-6);assert.ok(Math.abs(Math.hypot(...g.normals.slice(i,i+3))-1)<1e-6)}
 for(let i=0;i<g.indices.length;i+=3){const [a,b,c]=Array.from(g.indices.slice(i,i+3),n=>Array.from(g.positions.slice(n*3,n*3+3)));const u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n.reduce((s,v,j)=>s+v*a[j],0)>0)}
 const big=new SphereGeometry({widthSegments:256,heightSegments:256});assert.ok(big.indices instanceof Uint32Array);g.dispose();big.dispose()
})
test('sphere rejects non-finite dimensions before tessellation',()=>{
 for(const value of [NaN,Infinity,-Infinity])for(const key of ['radius','widthSegments','heightSegments'])assert.throws(()=>new SphereGeometry({[key]:value}),/finite/)
 assert.throws(()=>new SphereGeometry({radius:0}));assert.throws(()=>new SphereGeometry({widthSegments:2}));assert.throws(()=>new SphereGeometry({heightSegments:1}))
})
test('offscreen casters remain independent of the camera queue',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera({fieldOfView:60,aspect:1,near:.1,far:100});const caster=new Mesh({geometry:new BoxGeometry(),material:new BasicMaterial(),castShadow:true});caster.position.set(50,2,-10);scene.add(caster)
 camera.position.set(0,2,0);camera.lookAt([0,2,-10]);camera.updateMatrices();scene.updateWorldMatrix();const q=new RenderQueueBuilder(),visible=q.build(scene,camera,{frustumCulling:true});assert.equal(visible.opaque.length,0);assert.deepEqual(q.buildShadowCasters(scene).map(x=>x.mesh),[caster]);assert.equal(visible.opaque.length,0);caster.visible=false;scene.updateWorldMatrix();assert.equal(q.buildShadowCasters(scene).length,0);scene.dispose()
})
test('per-cascade WebGPU buffers retain separate matrix data and are all destroyed',()=>{
 const old=globalThis.GPUBufferUsage;globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8};const r=new WebGPURenderer(),buffers=[]
 r.device={createBuffer(){const b={destroyed:false,destroy(){this.destroyed=true}};buffers.push(b);return b},createBindGroup(x){return x},destroy(){}};r.shadowBindGroupLayout={}
 try{const mesh={id:'caster'},uniforms=[0,1,2].map(i=>r.getShadowUniform(mesh,i));uniforms.forEach((x,i)=>{x.values.fill(i+1);x.buffer.data=x.values.slice()});assert.equal(new Set(uniforms.map(x=>x.buffer)).size,3);assert.deepEqual(uniforms.map(x=>x.buffer.data[16]),[1,2,3]);assert.equal(r.getShadowUniform(mesh,1),uniforms[1]);assert.notEqual(r.getShadowUniform({id:'other'},1).buffer,uniforms[1].buffer);r.dispose();assert.ok(buffers.every(x=>x.destroyed))}finally{r.dispose();if(old===undefined)delete globalThis.GPUBufferUsage;else globalThis.GPUBufferUsage=old}
})
