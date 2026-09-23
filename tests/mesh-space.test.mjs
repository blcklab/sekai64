import test from 'node:test'
import assert from 'node:assert/strict'
import { AnimationRendererModule, SkinnedGeometry, SkeletonResource } from '../dist/animation/index.js'
import { Mesh, Node } from '../dist/scene/index.js'
import { BasicMaterial } from '../dist/materials/index.js'
import { Vector3 } from '../dist/math/index.js'
const close = (a,b) => a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<.0002, `${a} != ${b}`))
for (const scale of [1, .1, 10]) test(`skinned mesh root transform is applied once at scale ${scale}`,()=>{
 const root = new Node(); const joint = new Node();
 const geometry = new SkinnedGeometry({positions:new Float32Array([2,.17,-3]),jointIndices:new Uint16Array([0,0,0,0]),jointWeights:new Float32Array([1,0,0,0])});
 const mesh = new Mesh({geometry,material:new BasicMaterial()});root.add(joint,mesh);
 const skeleton=new SkeletonResource({id:'test',joints:[joint]});const module=new AnimationRendererModule();module.bind(mesh,skeleton);
 root.position.set(7,2,9);root.rotation.set(0,.8,0);root.scale.set(scale,scale,scale);
 module.update(0);
 close([...geometry.positions],[2,.17,-3]);
 const actual=new Vector3(...geometry.positions).applyMatrix4(mesh.worldMatrix);
 const expected=new Vector3(2,.17,-3).applyMatrix4(root.worldMatrix);
 close([actual.x,actual.y,actual.z],[expected.x,expected.y,expected.z]);
 for(let i=0;i<120;i++){root.position.x+=.02;module.update(1/60)}
 close([...geometry.positions],[2,.17,-3]);
 joint.position.y=.5;module.update(0);close([...geometry.positions],[2,.67,-3]);
 module.dispose();skeleton.dispose();root.dispose();geometry.dispose();
})
test('two meshes sharing a skeleton each receive their own local palette',()=>{
 const root=new Node(), joint=new Node();root.add(joint);root.position.set(5,0,3);
 const skeleton=new SkeletonResource({id:'shared',joints:[joint]});const module=new AnimationRendererModule();
 for(const x of [0,2]){
  const g=new SkinnedGeometry({positions:new Float32Array([1,0,0]),jointIndices:new Uint16Array([0,0,0,0]),jointWeights:new Float32Array([1,0,0,0])});
  const m=new Mesh({geometry:g,material:new BasicMaterial()});m.position.x=x;root.add(m);module.bind(m,skeleton);
 }
 module.update(0);
 for(const mesh of root.children.filter(n=>n.geometry)) { const p=new Vector3(...mesh.geometry.positions).applyMatrix4(mesh.worldMatrix);close([p.x,p.y,p.z],[6,0,3]) }
 module.dispose();skeleton.dispose();root.dispose();
})
