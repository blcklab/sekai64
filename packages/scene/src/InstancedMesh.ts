import type { Geometry } from '@sekai64-internal/geometry'
import { Box3, Matrix4 } from '@sekai64-internal/math'
import { Mesh, type MeshOptions } from './Mesh.js'

export interface InstancedMeshOptions extends Omit<MeshOptions,'geometry'> { geometry:Geometry;count:number;matrices?:Float32Array }
export class InstancedMesh extends Mesh {
  readonly count:number
  readonly instanceMatrices:Float32Array
  instanceVersion=0
  private cachedBoundsVersion=-1
  private readonly cachedBounds=new Box3()
  constructor(options:InstancedMeshOptions){super(options);if(!Number.isInteger(options.count)||options.count<1)throw new Error('InstancedMesh count must be a positive integer.');this.count=options.count;this.instanceMatrices=options.matrices??new Float32Array(options.count*16);if(this.instanceMatrices.length!==options.count*16)throw new Error('InstancedMesh matrices length must equal count * 16.');if(!options.matrices){const identity=new Matrix4().elements;for(let i=0;i<options.count;i++)this.instanceMatrices.set(identity,i*16)}}
  setMatrixAt(index:number,matrix:Matrix4|ArrayLike<number>):this{this.assertIndex(index);const source=matrix instanceof Matrix4?matrix.elements:matrix;if(source.length<16)throw new Error('Instance matrix requires 16 values.');for(let i=0;i<16;i++)this.instanceMatrices[index*16+i]=source[i]??0;this.instanceVersion++;return this}
  getMatrixAt(index:number,target=new Matrix4()):Matrix4{this.assertIndex(index);target.elements.set(this.instanceMatrices.subarray(index*16,index*16+16));return target}
  computeLocalBounds():Box3{if(this.cachedBoundsVersion===this.instanceVersion)return this.cachedBounds;this.cachedBounds.makeEmpty();const matrix=new Matrix4();for(let i=0;i<this.count;i++){this.getMatrixAt(i,matrix);this.cachedBounds.expandByBox(this.geometry.bounds.clone().applyMatrix4(matrix))}this.cachedBoundsVersion=this.instanceVersion;return this.cachedBounds}
  override clone():InstancedMesh{const copy=new InstancedMesh({id:this.id,name:this.name,tags:[...this.tags],visible:this.visible,layerMask:this.layerMask,geometry:this.geometry,materials:this.materials,materialGroupSlots:this.materialGroupSlots,ownsResources:false,castShadow:this.castShadow,receiveShadow:this.receiveShadow,count:this.count,matrices:new Float32Array(this.instanceMatrices)});copy.position.copy(this.position);copy.rotation.copy(this.rotation);copy.scale.copy(this.scale);return copy}
  private assertIndex(index:number):void{if(!Number.isInteger(index)||index<0||index>=this.count)throw new RangeError(`Instance index ${index} is outside 0..${this.count-1}.`)}
}
