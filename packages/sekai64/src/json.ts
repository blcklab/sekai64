import { OrthographicCamera, PerspectiveCamera, type Camera } from '@sekai64-internal/cameras'
import { BoxGeometry, CylinderGeometry, PlaneGeometry } from '@sekai64-internal/geometry'
import { AmbientLight, DirectionalLight, PointLight, SpotLight } from '@sekai64-internal/lighting'
import { BasicMaterial, StandardMaterial } from '@sekai64-internal/materials'
import type { ColorInput } from '@sekai64-internal/math'
import { Mesh, Node, Scene } from '@sekai64-internal/scene'

export type Vector3Tuple = readonly [number, number, number]
export type SceneVersion = 1 | 2
export interface SceneDefinition {
  $schema?: string
  version: SceneVersion
  variables?: Readonly<Record<string, string | number | boolean>>
  prefabs?: Readonly<Record<string, SceneObjectDefinition>>
  scene: {
    name?: string
    environment?: { background?: ColorInput }
    camera?: CameraDefinition
    objects?: readonly SceneObjectDefinition[]
  }
}
export type CameraDefinition =
  | { type: 'perspective'; id?: string; position?: Vector3Tuple; rotation?: Vector3Tuple; fieldOfView?: number; near?: number; far?: number }
  | { type: 'orthographic'; id?: string; position?: Vector3Tuple; rotation?: Vector3Tuple; left?: number; right?: number; top?: number; bottom?: number; near?: number; far?: number }

export interface BaseObjectDefinition { id?: string; name?: string; position?: Vector3Tuple; rotation?: Vector3Tuple; scale?: Vector3Tuple; visible?: boolean; tags?: readonly string[]; children?: readonly SceneObjectDefinition[]; interactions?: Readonly<Record<string,{action:string;value?:unknown}>> }
export interface NodeObjectDefinition extends BaseObjectDefinition { type:'node' }
export interface BoxObjectDefinition extends BaseObjectDefinition { type:'box';size?:Vector3Tuple;material?:MaterialDefinition }
export interface PlaneObjectDefinition extends BaseObjectDefinition { type:'plane';size?:readonly[number,number];material?:MaterialDefinition }
export interface CylinderObjectDefinition extends BaseObjectDefinition { type:'cylinder';radiusTop?:number;radiusBottom?:number;height?:number;radialSegments?:number;openEnded?:boolean;material?:MaterialDefinition }
export interface LightObjectDefinition extends BaseObjectDefinition { type:'ambient-light'|'directional-light'|'point-light'|'spot-light';color?:ColorInput;intensity?:number;direction?:Vector3Tuple;range?:number;decay?:number;innerCone?:number;outerCone?:number }
export interface PrefabObjectDefinition extends BaseObjectDefinition { type:'prefab';ref:string;overrides?:Readonly<Record<string,unknown>> }
export interface MaterialDefinition { type?:'basic'|'standard';baseColor?:ColorInput;metallic?:number;roughness?:number;emissive?:ColorInput;emissiveIntensity?:number;transparent?:boolean;doubleSided?:boolean;side?:'front'|'back'|'double';wireframe?:boolean;alphaMode?:'opaque'|'mask'|'blend';alphaCutoff?:number }
export type SceneObjectDefinition=NodeObjectDefinition|BoxObjectDefinition|PlaneObjectDefinition|CylinderObjectDefinition|LightObjectDefinition|PrefabObjectDefinition|(BaseObjectDefinition&{type:string;[key:string]:unknown})
export type SceneObjectFactory=(definition:SceneObjectDefinition,path:string)=>Node|Promise<Node>
export type ScenePatchOperation={op:'replace'|'add'|'remove';path:string;value?:unknown}

export class LoadedScene {
  readonly scene:Scene
  readonly camera:Camera
  private readonly definition:SceneDefinition
  private readonly factories?:ReadonlyMap<string,SceneObjectFactory>
  constructor(scene:Scene,camera:Camera,definition:SceneDefinition,factories?:ReadonlyMap<string,SceneObjectFactory>){this.scene=scene;this.camera=camera;this.definition=definition;this.factories=factories}
  get(id:string):Node|undefined{return this.scene.get(id)}
  patch(operations:readonly ScenePatchOperation[]):void{for(const operation of operations){if(operation.op==='add')throw new Error('Use patchAsync() for add operations.');applyRuntimePatch(this.scene,operation);patchSerializableDefinition(this.definition,operation)}}
  async patchAsync(operations:readonly ScenePatchOperation[]):Promise<void>{for(const operation of operations){if(operation.op==='add')await addRuntimeObject(this.scene,this.definition,operation,this.factories);else applyRuntimePatch(this.scene,operation);patchSerializableDefinition(this.definition,operation)}}
  serialize():SceneDefinition{return structuredCloneSafe(this.definition)}
  dispose():void{this.scene.dispose();this.camera.dispose()}
}

export interface LoadSceneOptions { objectFactories?:ReadonlyMap<string,SceneObjectFactory> }
export async function loadSceneDefinition(input:SceneDefinition,options:LoadSceneOptions={}):Promise<LoadedScene>{
  validateSceneDefinition(input)
  const definition=migrateSceneDefinition(input)
  const expanded=expandDefinition(definition)
  const serializable=structuredCloneSafe(definition)
  const scene=new Scene({name:definition.scene.name??'JSON Scene',autoDisposeResources:true})
  const camera=createCamera(definition.scene.camera)
  for(let index=0;index<expanded.scene.objects.length;index++)scene.add(await createObject(expanded.scene.objects[index] as SceneObjectDefinition,`scene.objects[${index}]`,options.objectFactories))
  return new LoadedScene(scene,camera,serializable,options.objectFactories)
}

export function migrateSceneDefinition(input:SceneDefinition):SceneDefinition{
  const clone=structuredCloneSafe(input)
  if(clone.version===1){clone.version=2;clone.$schema=clone.$schema?.replace(/scene-v1\.json$/, 'scene-v2.json')??'https://sekai64.dev/schemas/scene-v2.json'}
  return clone
}

export function validateSceneDefinition(value:unknown):asserts value is SceneDefinition{
  assertSafeValue(value,'$',0)
  if(!isPlainObject(value))fail('$','Scene definition must be a plain object.')
  if(value.version!==1&&value.version!==2)fail('version','Supported scene versions are 1 and 2.')
  if(!isPlainObject(value.scene))fail('scene','Expected a scene object.')
  if(value.variables!==undefined&&!isPlainObject(value.variables))fail('variables','Expected a plain object.')
  if(value.prefabs!==undefined&&!isPlainObject(value.prefabs))fail('prefabs','Expected a plain object.')
  if(value.scene.objects!==undefined&&!Array.isArray(value.scene.objects))fail('scene.objects','Expected an array.')
  const ids=new Set<string>(),objects=value.scene.objects??[]
  if(objects.length>10000)fail('scene.objects','Scene exceeds the 10,000-object safety limit.')
  for(let index=0;index<objects.length;index++)validateObject(objects[index],`scene.objects[${index}]`,0,ids)
  for(const [name,prefab] of Object.entries(value.prefabs??{}))validateObject(prefab,`prefabs.${name}`,0,new Set())
}

function validateObject(value:unknown,path:string,depth:number,ids:Set<string>):void{
  if(depth>64)fail(path,'Scene hierarchy exceeds the maximum depth of 64.')
  if(!isPlainObject(value))fail(path,'Expected an object definition.')
  if(typeof value.type!=='string'||value.type.length===0)fail(`${path}.type`,'Expected a non-empty object type.')
  if(value.id!==undefined){if(typeof value.id!=='string'||!value.id)fail(`${path}.id`,'Expected a non-empty string.');if(ids.has(value.id))fail(`${path}.id`,`Duplicate object ID "${value.id}".`);ids.add(value.id)}
  validateTuple(value.position,`${path}.position`);validateTuple(value.rotation,`${path}.rotation`);validateTuple(value.scale,`${path}.scale`,true)
  if(value.children!==undefined){if(!Array.isArray(value.children))fail(`${path}.children`,'Expected an array.');for(let index=0;index<value.children.length;index++)validateObject(value.children[index],`${path}.children[${index}]`,depth+1,ids)}
  if(value.interactions!==undefined&&!isPlainObject(value.interactions))fail(`${path}.interactions`,'Expected an interaction map.')
}

function expandDefinition(definition:SceneDefinition):{scene:{objects:SceneObjectDefinition[]}}{
  const variables=definition.variables??{},prefabs=definition.prefabs??{}
  const expand=(object:SceneObjectDefinition,path:string):SceneObjectDefinition=>{
    let source=resolveVariables(structuredCloneSafe(object),variables) as SceneObjectDefinition
    if(source.type==='prefab'){
      const prefab=source as PrefabObjectDefinition,base=prefabs[prefab.ref]
      if(!base)fail(`${path}.ref`,`Unknown prefab "${prefab.ref}".`)
      source=deepMerge(structuredCloneSafe(base),prefab.overrides??{},stripPrefabFields(prefab)) as SceneObjectDefinition
      source=resolveVariables(source,variables) as SceneObjectDefinition
    }
    if(source.children)source={...source,children:source.children.map((child,index)=>expand(child,`${path}.children[${index}]`))}
    return source
  }
  return{scene:{objects:(definition.scene.objects??[]).map((object,index)=>expand(object,`scene.objects[${index}]`))}}
}

async function createObject(definition:SceneObjectDefinition,path:string,factories?:ReadonlyMap<string,SceneObjectFactory>):Promise<Node>{
  let node:Node;const base=definition as BaseObjectDefinition
  if(definition.type==='node')node=new Node({id:base.id,name:base.name,tags:base.tags,visible:base.visible})
  else if(definition.type==='box'){const box=definition as BoxObjectDefinition,size=box.size??[1,1,1];validateTuple(size,`${path}.size`,true);node=new Mesh({id:box.id,name:box.name,tags:box.tags,visible:box.visible,geometry:new BoxGeometry({width:size[0],height:size[1],depth:size[2],label:box.id?`${box.id}:geometry`:undefined}),material:createMaterial(box.material,box.id),ownsResources:true})}
  else if(definition.type==='plane'){const plane=definition as PlaneObjectDefinition,size=plane.size??[1,1];if(!Array.isArray(size)||size.length!==2||size.some(value=>typeof value!=='number'||value<=0))fail(`${path}.size`,'Expected two positive numbers.');node=new Mesh({id:plane.id,name:plane.name,tags:plane.tags,visible:plane.visible,geometry:new PlaneGeometry({width:size[0],height:size[1],label:plane.id?`${plane.id}:geometry`:undefined}),material:createMaterial(plane.material,plane.id),ownsResources:true})}
  else if(definition.type==='cylinder'){const cylinder=definition as CylinderObjectDefinition;node=new Mesh({id:cylinder.id,name:cylinder.name,tags:cylinder.tags,visible:cylinder.visible,geometry:new CylinderGeometry({radiusTop:cylinder.radiusTop,radiusBottom:cylinder.radiusBottom,height:cylinder.height,radialSegments:cylinder.radialSegments,openEnded:cylinder.openEnded,label:cylinder.id?`${cylinder.id}:geometry`:undefined}),material:createMaterial(cylinder.material,cylinder.id),ownsResources:true})}
  else if(definition.type==='ambient-light'){const light=definition as LightObjectDefinition;node=new AmbientLight({id:light.id,name:light.name,color:light.color,intensity:light.intensity})}
  else if(definition.type==='directional-light'){const light=definition as LightObjectDefinition;node=new DirectionalLight({id:light.id,name:light.name,color:light.color,intensity:light.intensity,direction:light.direction})}
  else if(definition.type==='point-light'){const light=definition as LightObjectDefinition;node=new PointLight({id:light.id,name:light.name,color:light.color,intensity:light.intensity,range:light.range,decay:light.decay})}
  else if(definition.type==='spot-light'){const light=definition as LightObjectDefinition;node=new SpotLight({id:light.id,name:light.name,color:light.color,intensity:light.intensity,range:light.range,decay:light.decay,direction:light.direction,innerCone:light.innerCone,outerCone:light.outerCone})}
  else{const factory=factories?.get(definition.type);if(!factory)fail(`${path}.type`,`Unknown object type "${definition.type}". Register a plugin factory before loading the scene.`);node=await factory(definition,path)}
  applyTransform(node,base,path)
  for(let index=0;index<(definition.children?.length??0);index++)node.add(await createObject(definition.children?.[index] as SceneObjectDefinition,`${path}.children[${index}]`,factories))
  return node
}

function createMaterial(definition:MaterialDefinition|undefined,id?:string):BasicMaterial|StandardMaterial{
  if(definition?.type==='standard'||definition?.metallic!==undefined||definition?.roughness!==undefined||definition?.emissive!==undefined)return new StandardMaterial({label:id?`${id}:material`:undefined,baseColor:definition.baseColor??'#ffffff',metallic:definition.metallic,roughness:definition.roughness,emissive:definition.emissive,emissiveIntensity:definition.emissiveIntensity,alphaMode:definition.alphaMode??(definition.transparent?'blend':'opaque'),alphaCutoff:definition.alphaCutoff,doubleSided:definition.doubleSided,side:definition.side,wireframe:definition.wireframe})
  return new BasicMaterial({label:id?`${id}:material`:undefined,baseColor:definition?.baseColor??'#ffffff',transparent:definition?.transparent,doubleSided:definition?.doubleSided,side:definition?.side,wireframe:definition?.wireframe})
}
function createCamera(definition:CameraDefinition|undefined):Camera{const source=definition??{type:'perspective' as const};let camera:Camera;if(source.type==='orthographic')camera=new OrthographicCamera({id:source.id??'camera',left:source.left,right:source.right,top:source.top,bottom:source.bottom,near:source.near,far:source.far});else camera=new PerspectiveCamera({id:source.id??'camera',fieldOfView:source.fieldOfView,near:source.near,far:source.far});if(source.position)camera.position.fromArray(source.position);else camera.position.set(0,0,5);if(source.rotation)camera.rotation.set(...source.rotation);return camera}
function applyTransform(node:Node,definition:BaseObjectDefinition,path:string):void{if(definition.position){validateTuple(definition.position,`${path}.position`);node.position.fromArray(definition.position)}if(definition.rotation){validateTuple(definition.rotation,`${path}.rotation`);node.rotation.set(...definition.rotation)}if(definition.scale){validateTuple(definition.scale,`${path}.scale`,true);node.scale.fromArray(definition.scale)}}

function applyRuntimePatch(scene:Scene,operation:ScenePatchOperation):void{
  const parts=parsePatchPath(operation.path)
  if(parts[0]!=='objects'||parts.length<2)fail(operation.path,'Patch paths must use /objects/{id}.')
  const id=parts[1] as string,node=scene.get(id)
  if(!node)fail(operation.path,`Scene object "${id}" does not exist.`)
  if(operation.op==='remove'){if(parts.length!==2)fail(operation.path,'Remove currently supports complete objects only.');node.dispose();return}
  if(operation.op!=='replace')fail(operation.path,`Unsupported synchronous patch operation: ${operation.op}`)
  const property=parts[2]
  if(property==='position'||property==='rotation'||property==='scale'){validateTuple(operation.value,operation.path,property==='scale');const tuple=operation.value as Vector3Tuple;if(property==='rotation')node.rotation.set(...tuple);else node[property].fromArray(tuple);return}
  if(property==='visible'&&typeof operation.value==='boolean'){node.visible=operation.value;return}
  if(property==='name'&&typeof operation.value==='string'){node.name=operation.value;return}
  if(property==='material'&&parts[3]==='baseColor'&&node instanceof Mesh&&(node.material instanceof BasicMaterial||node.material instanceof StandardMaterial)){node.material.setBaseColor(operation.value as ColorInput);return}
  fail(operation.path,'This property is not patchable.')
}
async function addRuntimeObject(scene:Scene,definition:SceneDefinition,operation:ScenePatchOperation,factories?:ReadonlyMap<string,SceneObjectFactory>):Promise<void>{const parts=parsePatchPath(operation.path);if(parts[0]!=='objects'||parts.length!==1)fail(operation.path,'Add object path must be /objects.');if(!isPlainObject(operation.value))fail(operation.path,'Add operation requires an object definition.');validateObject(operation.value,operation.path,0,new Set([...scene.children.map(node=>node.id)]));scene.add(await createObject(operation.value as SceneObjectDefinition,`scene.objects[${definition.scene.objects?.length??0}]`,factories))}
function patchSerializableDefinition(definition:SceneDefinition,operation:ScenePatchOperation):void{const parts=parsePatchPath(operation.path);const objects=[...(definition.scene.objects??[])];if(operation.op==='add'){objects.push(structuredCloneSafe(operation.value) as SceneObjectDefinition);definition.scene.objects=objects;return}const id=parts[1]??'',located=findDefinition(objects,id);if(!located)return;if(operation.op==='remove'){located.collection.splice(located.index,1);definition.scene.objects=objects;return}const object=located.object;if(parts[2]==='material'&&parts[3]==='baseColor'){const material=isPlainObject(object.material)?object.material:{};material.baseColor=operation.value;object.material=material}else object[parts[2] as string]=operation.value;definition.scene.objects=objects}
function findDefinition(objects:SceneObjectDefinition[],id:string):{object:Record<string,unknown>;collection:SceneObjectDefinition[];index:number}|undefined{for(let index=0;index<objects.length;index++){const object=objects[index] as SceneObjectDefinition;if(object.id===id)return{object:object as unknown as Record<string,unknown>,collection:objects,index};if(object.children){const children=[...object.children];const child=findDefinition(children,id);if(child){object.children=children;return child}}}return undefined}

function resolveVariables(value:unknown,variables:Readonly<Record<string,string|number|boolean>>):unknown{if(typeof value==='string')return value.replace(/\$\{([\w.-]+)\}/g,(_,name:string)=>String(variables[name]??`\${${name}}`));if(Array.isArray(value))return value.map(item=>resolveVariables(item,variables));if(isPlainObject(value)){const result:Record<string,unknown>={};for(const [key,item]of Object.entries(value))result[key]=resolveVariables(item,variables);return result}return value}
function stripPrefabFields(prefab:PrefabObjectDefinition):Record<string,unknown>{const result={...prefab} as Record<string,unknown>;delete result.type;delete result.ref;delete result.overrides;return result}
function deepMerge(...sources:readonly unknown[]):unknown{const result:Record<string,unknown>={};for(const source of sources)if(isPlainObject(source))for(const [key,value]of Object.entries(source))result[key]=isPlainObject(value)&&isPlainObject(result[key])?deepMerge(result[key],value):structuredCloneSafe(value);return result}
function parsePatchPath(path:string):string[]{return path.split('/').filter(Boolean).map(part=>decodeURIComponent(part.replace(/~1/g,'/').replace(/~0/g,'~')))}
function validateTuple(value:unknown,path:string,positive=false):void{if(value===undefined)return;if(!Array.isArray(value)||value.length!==3||value.some(item=>typeof item!=='number'||!Number.isFinite(item)))fail(path,'Expected exactly three finite numbers.');if(positive&&value.some(item=>item<=0))fail(path,'Expected values greater than zero.')}
function assertSafeValue(value:unknown,path:string,depth:number):void{if(depth>96)fail(path,'Input exceeds the maximum nesting depth.');if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(key==='__proto__'||key==='prototype'||key==='constructor')fail(`${path}.${key}`,'Unsafe object key is not allowed.');assertSafeValue((value as Record<string,unknown>)[key],`${path}.${key}`,depth+1)}}
function isPlainObject(value:unknown):value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null}
function structuredCloneSafe<T>(value:T):T{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)) as T}
function fail(path:string,message:string):never{throw new Error(`Sekai64 scene validation failed at ${path}: ${message}`)}
