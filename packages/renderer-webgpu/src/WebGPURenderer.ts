/// <reference path="./webgpu.d.ts" />
import type { Camera } from '@sekai64-internal/cameras'
import type { Geometry } from '@sekai64-internal/geometry'
import { collectSceneLights } from '@sekai64-internal/lighting'
import { BasicMaterial, DepthMaterial, NormalMaterial, ShaderMaterial, StandardMaterial, Texture, TextureMaterial, type Material, type UniformValue } from '@sekai64-internal/materials'
import { Box3, Color, Frustum, Matrix4, Vector3, type ColorInput } from '@sekai64-internal/math'
import { ClusteredLightGrid, GeometryResidencyManager, RenderQueueBuilder, createDirectionalShadowCascades, createProceduralCloudNoise, createRendererAdvancedCapabilities, createRendererFeatures, createRendererStats, HierarchicalDepthCuller, resolveAtmosphere, resolveColorGrading, resolveColorManagement, resolveEnvironmentLighting, resolveImageQuality, resolveOptimization, resolvePostProcessing, resolveProceduralCloudState, resolveShadowOptions, srgbToLinear, TextureResidencyManager, type RecoverableRenderer, type RendererAtmosphere, type RendererCapabilities, type RendererColorGrading, type RendererColorManagement, type RendererDiagnosticSink, type RendererEnvironmentLighting, type RendererEnvironmentMap, type RendererImageQuality, type RendererOptimizationOptions, type RendererOptions, type RendererPostProcessing, type RendererProceduralCloudInput, type RendererProceduralCloudState, type RendererRecoveryOptions, type RendererShadowOptions, type RendererStats, type RenderSurface, type ClusteredPointLight, type RenderItem } from '@sekai64-internal/renderer'
import { InstancedMesh, PointField, type Mesh, type Scene } from '@sekai64-internal/scene'
import { WebGPUPostProcessPipeline } from './WebGPUPostProcessPipeline.js'

interface WebGPUGeometry {
  positionBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  uvBuffer: GPUBuffer
  uv1Buffer: GPUBuffer
  colorBuffer: GPUBuffer
  tangentBuffer: GPUBuffer
  indexBuffer?: GPUBuffer
  count: number
  indexed: boolean
  indexFormat: GPUIndexFormat
  bytes: number
  version: number
}
interface WebGPUTextureState {
  texture: GPUTexture
  view: GPUTextureView
  sampler: GPUSampler
  version: number
  bytes: number
  width: number
  height: number
  format: GPUTextureFormat
  mipLevelCount: number
  lastUsedFrame: number
}
interface WebGPUObjectUniform {
  buffer: GPUBuffer
  bindGroup: GPUBindGroup
  values: Float32Array
  textureStates: readonly WebGPUTextureState[]
  shadowGeneration: number
}
interface WebGPUShadowUniform { buffer: GPUBuffer; bindGroup: GPUBindGroup; values: Float32Array; textureState: WebGPUTextureState }
interface WebGPUShaderUniform {
  buffer: GPUBuffer
  bindGroup: GPUBindGroup
  values: Float32Array
}
interface WebGPUInstances { matrixBuffer: GPUBuffer; colorBuffer: GPUBuffer; matrixVersion: number; colorVersion: number; bytes: number }
interface WebGPUPointFieldState {
  positionBuffer: GPUBuffer
  colorBuffer: GPUBuffer
  appearanceBuffer: GPUBuffer
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  count: number
  version: number
  bytes: number
}
interface TextureBinding { texture?: Texture; texCoord: 0 | 1 }
interface MaterialSurface {
  color: Color
  emissive: readonly [number, number, number]
  mode: number
  alphaCutoff: number
  metallicFactor: number
  roughnessFactor: number
  normalScale: number
  occlusionStrength: number
  textureScale: readonly [number, number]
  textureOffset: readonly [number, number]
  textureRotation: number
  forceOpaqueAlpha: boolean
  baseColor: TextureBinding
  metallicRoughness: TextureBinding
  metallic: TextureBinding
  roughness: TextureBinding
  normal: TextureBinding
  emissiveTexture: TextureBinding
  occlusion: TextureBinding
  detailNormal: TextureBinding
  detailRoughness: TextureBinding
  detailHeight: TextureBinding
  detailScale: number
  detailNormalStrength: number
  detailRoughnessStrength: number
  detailHeightScale: number
  transmission: number
  ior: number
  thickness: number
  attenuationColor: readonly [number, number, number]
  attenuationDistance: number
  toonParams: readonly [number, number, number, number]
  toonParams2: readonly [number, number, number, number]
  toonShadowColor: readonly [number, number, number]
  toonHighlightColor: readonly [number, number, number]
  toonRimColor: readonly [number, number, number]
  toonOutlineColor: readonly [number, number, number]
  faceShadow: TextureBinding
  faceShadowStrength: number
  faceShadowFlipX: boolean
  hairAlphaDither: boolean
  outlineWidth: number
  lightMap: TextureBinding
  lightMapIntensity: number
  specularFactor: number
  specularColor: readonly [number, number, number]
  clearcoat: number
  clearcoatRoughness: number
  sheenColor: readonly [number, number, number]
  sheenIntensity: number
  sheenRoughness: number
  alphaDither: boolean
  toonParams3: readonly [number, number, number, number]
  mtoonAdvanced2: readonly [number, number, number, number]
  waterParams: readonly [number, number, number, number]
  waterMotion: readonly [number, number, number, number]
  waterFlow: readonly [number, number]
  waterShallowColor: readonly [number, number, number]
  waterDeepColor: readonly [number, number, number]
  waterFoamColor: readonly [number, number, number]
}

const environmentBackgroundShader = `
const PI:f32=3.141592653589793;
struct BackgroundUniforms { inverseViewProjection: mat4x4<f32>, cameraPosition: vec4<f32>, params: vec4<f32>, outputParams: vec4<f32>, cloudParams: vec4<f32>, cloudMotion: vec4<f32>, cloudSun: vec4<f32>, cloudShape: vec4<f32>, cloudHorizon: vec4<f32>, cloudLighting: vec4<f32>, cloudDetailMotion: vec4<f32>, cloudAmbientColor: vec4<f32>, cloudShadowColor: vec4<f32>, cloudLightColor: vec4<f32> }
@group(0) @binding(0) var<uniform> background: BackgroundUniforms;
@group(0) @binding(1) var environmentSampler: sampler;
@group(0) @binding(2) var environmentTexture: texture_2d<f32>;
@group(0) @binding(3) var cloudSampler: sampler;
@group(0) @binding(4) var cloudTexture: texture_2d<f32>;
struct BackgroundVertexOutput { @builtin(position) position: vec4<f32>, @location(0) ndc: vec2<f32> }
@vertex fn background_vertex(@builtin(vertex_index) index:u32)->BackgroundVertexOutput{var positions=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));let p=positions[index];var output:BackgroundVertexOutput;output.position=vec4<f32>(p,0.999999,1.0);output.ndc=p;return output;}
fn linearChannelToSrgb(value:f32)->f32{return select(1.055*pow(max(value,0.0),1.0/2.4)-0.055,12.92*value,value<=0.0031308);}
fn linearToSrgb(value:vec3<f32>)->vec3<f32>{return vec3<f32>(linearChannelToSrgb(value.r),linearChannelToSrgb(value.g),linearChannelToSrgb(value.b));}
fn toneMap(color:vec3<f32>,mode:f32)->vec3<f32>{let c=max(color,vec3<f32>(0.0));if(mode<0.5){return c;}if(mode<1.5){return c/(vec3<f32>(1.0)+c);}if(mode>2.5){return c/(vec3<f32>(1.0)+max(c,vec3<f32>(0.0))*0.6);}return clamp((c*(2.51*c+vec3<f32>(0.03)))/(c*(2.43*c+vec3<f32>(0.59))+vec3<f32>(0.14)),vec3<f32>(0.0),vec3<f32>(1.0));}
fn environmentUv(direction:vec3<f32>)->vec2<f32>{let d=normalize(direction);let phi=atan2(d.z,d.x)+background.params.y;return vec2<f32>(fract(phi/(2.0*PI)+0.5),acos(clamp(d.y,-1.0,1.0))/PI);}
fn cloudDomeCoordinate(direction:vec3<f32>,horizonCompression:f32)->vec2<f32>{let d=normalize(direction);let horizontal=length(d.xz);let theta=acos(clamp(d.y,-1.0,1.0));if(horizontal<=0.000001||theta<=0.000001){return vec2<f32>(0.0);}var radial=theta/(0.5*PI);if(radial>1.0){let underlapScale=mix(1.0,0.18,clamp(horizonCompression,0.0,1.0));radial=1.0+(radial-1.0)*underlapScale;}return (d.xz/horizontal)*radial*0.45;}
fn smoothNoise(uv:vec2<f32>,channel:i32)->f32{let n=textureSampleLevel(cloudTexture,cloudSampler,fract(uv),0.0);if(channel==0){return n.r;}if(channel==1){return n.g;}if(channel==2){return n.b;}return n.a;}
fn cloudMacroField(base:vec2<f32>,evolution:f32)->f32{let macroScale=max(background.cloudShape.x,0.2);let warp=smoothNoise(base*(0.16*macroScale)+vec2<f32>(evolution*0.043,-evolution*0.031),3);let w=vec2<f32>(warp-0.5)*background.cloudShape.w;let large=smoothNoise((base+vec2<f32>(evolution*0.018,evolution*0.011))*(0.34*macroScale)+w,0);let medium=smoothNoise((base+vec2<f32>(-evolution*0.027,evolution*0.021))*(0.78*macroScale)+w*1.25,1);return clamp(large*0.74+medium*0.26,0.0,1.0);}
fn cloudDetailField(base:vec2<f32>,evolution:f32)->f32{let detailScale=max(background.cloudShape.y,0.2);let small=smoothNoise((base+vec2<f32>(evolution*0.081,-evolution*0.063))*(1.85*detailScale),2);let fine=smoothNoise((base+vec2<f32>(-evolution*0.127,evolution*0.097))*(3.6*detailScale),3);return clamp(small*0.78+fine*0.22,0.0,1.0);}
fn proceduralCloud(direction:vec3<f32>)->vec4<f32>{let horizonExtension=max(background.cloudLighting.z,0.0);if(background.cloudParams.x<0.5||background.cloudParams.y<=0.0||direction.y<=-horizonExtension){return vec4<f32>(0.0);}let vertical=clamp(direction.y,0.0,1.0);let underlapDistance=select(0.0,clamp(-direction.y/max(horizonExtension,0.0001),0.0,1.0),horizonExtension>0.0001);let underlapFade=select(smoothstep(-horizonExtension,0.0,direction.y),1.0,direction.y>=0.0);let domain=cloudDomeCoordinate(direction,background.cloudLighting.w)*background.cloudParams.w;let macroBase=domain+background.cloudMotion.xy;let detailBase=domain+background.cloudDetailMotion.xy;let macro=cloudMacroField(macroBase,background.cloudMotion.z);let detail=cloudDetailField(detailBase,background.cloudDetailMotion.z);let horizonBlend=smoothstep(0.0,max(background.cloudHorizon.z,0.01),vertical);let detailAtHorizon=mix(0.35,1.0,horizonBlend);let field=clamp(macro+(detail-0.5)*(background.cloudShape.z*detailAtHorizon),0.0,1.0);let threshold=mix(0.74,0.38,background.cloudParams.y);let softness=max(background.cloudHorizon.x,0.01);let body=smoothstep(threshold-softness,threshold+softness,field);let horizonPresence=mix(background.cloudHorizon.y,1.0,horizonBlend);let underlapAtmosphere=clamp(background.cloudDetailMotion.w,0.0,1.0);let underlapDensity=mix(1.0,0.72,underlapDistance*underlapAtmosphere);let amount=clamp(body*min(background.cloudParams.z,1.5)*horizonPresence*underlapFade*underlapDensity,0.0,1.0);if(amount<=0.0001){return vec4<f32>(0.0);}let eps=0.055/max(background.cloudShape.x,0.2);let gx=cloudMacroField(macroBase+vec2<f32>(eps,0.0),background.cloudMotion.z)-cloudMacroField(macroBase-vec2<f32>(eps,0.0),background.cloudMotion.z);let gz=cloudMacroField(macroBase+vec2<f32>(0.0,eps),background.cloudMotion.z)-cloudMacroField(macroBase-vec2<f32>(0.0,eps),background.cloudMotion.z);let pseudoNormal=normalize(vec3<f32>(-gx*1.45,1.0,-gz*1.45));let sunDirection=normalize(background.cloudSun.xyz);let diffuse=clamp(dot(pseudoNormal,sunDirection),0.0,1.0);let sunFacing=clamp(dot(direction,sunDirection),0.0,1.0);let interior=smoothstep(0.42,0.92,body);let edge=clamp(4.0*body*(1.0-body),0.0,1.0);let sunStrength=clamp(background.cloudSun.w/8.0,0.0,1.0);let litAmount=clamp((0.12+diffuse*background.cloudLighting.y)*sunStrength,0.0,1.0);var cloudColor=mix(background.cloudAmbientColor.xyz,background.cloudLightColor.xyz,litAmount);let shadowAmount=interior*(1.0-diffuse)*background.cloudLighting.x;cloudColor=mix(cloudColor,background.cloudShadowColor.xyz,clamp(shadowAmount,0.0,1.0));let silverLining=edge*pow(sunFacing,7.0)*background.cloudHorizon.w*sunStrength;cloudColor=cloudColor+vec3<f32>(silverLining,silverLining*0.92,silverLining*0.76);let distanceHaze=clamp((1.0-horizonBlend)*0.42+underlapDistance*underlapAtmosphere*0.5,0.0,0.92);cloudColor=mix(cloudColor,background.cloudAmbientColor.xyz,distanceHaze);return vec4<f32>(cloudColor,amount);}
@fragment fn background_fragment(input:BackgroundVertexOutput)->@location(0) vec4<f32>{let world=background.inverseViewProjection*vec4<f32>(input.ndc,1.0,1.0);let direction=normalize(world.xyz/max(abs(world.w),0.000001)-background.cameraPosition.xyz);var color=textureSampleLevel(environmentTexture,environmentSampler,environmentUv(direction),0.0).rgb*max(background.params.x,0.0);let cloud=proceduralCloud(direction);color=mix(color,cloud.rgb,cloud.a);if(background.params.z>0.5){color=toneMap(color*background.outputParams.x,background.outputParams.y);}if(background.outputParams.z>0.5){color=linearToSrgb(color);}return vec4<f32>(clamp(color,vec3<f32>(0.0),vec3<f32>(1.0)),1.0);}`

function createShaderSource(instanced: boolean): string { return `
const MAX_POINT_LIGHTS:u32=8u;
const MAX_SPOT_LIGHTS:u32=4u;
const PI:f32=3.141592653589793;
struct Uniforms {
  model: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  baseColor: vec4<f32>,
  emissive: vec4<f32>,
  ambient: vec4<f32>,
  directionalColor: vec4<f32>,
  directionalDirection: vec4<f32>,
  cameraPosition: vec4<f32>,
  materialParams: vec4<f32>,
  materialParams2: vec4<f32>,
  textureFlags: vec4<f32>,
  textureFlags2: vec4<f32>,
  textureCoords: vec4<f32>,
  textureFlags3: vec4<f32>,
  outputParams: vec4<f32>,
  environmentSky: vec4<f32>,
  environmentGround: vec4<f32>,
  environmentParams: vec4<f32>,
  glassParams: vec4<f32>,
  attenuationColor: vec4<f32>,
  shadowParams: vec4<f32>,
  cameraView: mat4x4<f32>,
  toonParams: vec4<f32>,
  toonParams2: vec4<f32>,
  toonShadowColor: vec4<f32>,
  toonHighlightColor: vec4<f32>,
  toonRimColor: vec4<f32>,
  toonOutlineColor: vec4<f32>,
  pointPositions: array<vec4<f32>, 8>,
  pointColors: array<vec4<f32>, 8>,
  spotPositions: array<vec4<f32>, 4>,
  spotDirections: array<vec4<f32>, 4>,
  spotColors: array<vec4<f32>, 4>,
  atmosphereColor: vec4<f32>,
  atmosphereParams: vec4<f32>,
  atmosphereParams2: vec4<f32>,
  gradingParams: vec4<f32>,
  gradingParams2: vec4<f32>,
  gradingParams3: vec4<f32>,
  viewportSize: vec4<f32>,
  shadowMatrices: array<mat4x4<f32>, 4>,
  shadowCascadeData: vec4<f32>,
  shadowSplits: vec4<f32>,
  mtoonAdvanced: vec4<f32>,
  environmentMapParams: vec4<f32>,
  pbrAdvanced: vec4<f32>,
  specularColor: vec4<f32>,
  sheenColor: vec4<f32>,
  waterParams: vec4<f32>,
  waterShallowColor: vec4<f32>,
  waterDeepColor: vec4<f32>,
  waterFoamColor: vec4<f32>,
  toonParams3: vec4<f32>,
  mtoonAdvanced2: vec4<f32>,
  lightMapParams: vec4<f32>,
  shadowQuality: vec4<f32>,
  environmentIblParams: vec4<f32>,
  textureTransform: vec4<f32>,
  textureRotation: vec4<f32>,
  detailParams: vec4<f32>,
  surfaceDetailParams: vec4<f32>,
  waterMotion: vec4<f32>,
  waterFlowTime: vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var baseColorSampler: sampler;
@group(0) @binding(2) var baseColorTexture: texture_2d<f32>;
@group(0) @binding(3) var metallicRoughnessSampler: sampler;
@group(0) @binding(4) var metallicRoughnessTexture: texture_2d<f32>;
@group(0) @binding(5) var normalSampler: sampler;
@group(0) @binding(6) var normalTexture: texture_2d<f32>;
@group(0) @binding(7) var emissiveSampler: sampler;
@group(0) @binding(8) var emissiveTexture: texture_2d<f32>;
@group(0) @binding(9) var occlusionSampler: sampler;
@group(0) @binding(10) var occlusionTexture: texture_2d<f32>;
@group(0) @binding(11) var metallicSampler: sampler;
@group(0) @binding(12) var metallicTexture: texture_2d<f32>;
@group(0) @binding(13) var roughnessSampler: sampler;
@group(0) @binding(14) var roughnessTexture: texture_2d<f32>;
@group(0) @binding(15) var shadowSampler: sampler_comparison;
@group(0) @binding(16) var shadowTexture: texture_depth_2d_array;
@group(0) @binding(17) var faceShadowSampler: sampler;
@group(0) @binding(18) var faceShadowTexture: texture_2d<f32>;
@group(0) @binding(19) var environmentSampler: sampler;
@group(0) @binding(20) var environmentTexture: texture_2d<f32>;
@group(0) @binding(21) var lightMapSampler: sampler;
@group(0) @binding(22) var lightMapTexture: texture_2d<f32>;
@group(0) @binding(23) var environmentDiffuseSampler: sampler;
@group(0) @binding(24) var environmentDiffuseTexture: texture_2d<f32>;
@group(0) @binding(25) var environmentBrdfSampler: sampler;
@group(0) @binding(26) var environmentBrdfTexture: texture_2d<f32>;
@group(0) @binding(27) var detailNormalSampler: sampler;
@group(0) @binding(28) var detailNormalTexture: texture_2d<f32>;
@group(0) @binding(29) var detailRoughnessSampler: sampler;
@group(0) @binding(30) var detailRoughnessTexture: texture_2d<f32>;
@group(0) @binding(31) var detailHeightSampler: sampler;
@group(0) @binding(32) var detailHeightTexture: texture_2d<f32>;
struct VertexOutput {
  @builtin(position) position:vec4<f32>,
  @location(0) normal:vec3<f32>,
  @location(1) uv:vec2<f32>,
  @location(2) worldPosition:vec3<f32>,
  @location(3) uv1:vec2<f32>,
  @location(4) color:vec4<f32>,
  @location(5) tangent:vec4<f32>,
}
@vertex fn vertex_main(@location(0) position:vec3<f32>,@location(1) normal:vec3<f32>,@location(2) uv:vec2<f32>,@location(7) uv1:vec2<f32>,@location(8) color:vec4<f32>,@location(9) tangent:vec4<f32>${instanced ? ',@location(3) instance0:vec4<f32>,@location(4) instance1:vec4<f32>,@location(5) instance2:vec4<f32>,@location(6) instance3:vec4<f32>,@location(10) instanceColor:vec4<f32>' : ''})->VertexOutput{
  var output:VertexOutput;
  ${instanced ? 'let instanceMatrix=mat4x4<f32>(instance0,instance1,instance2,instance3);let world=uniforms.model*instanceMatrix;' : 'let world=uniforms.model;'}
  let worldPosition=world*vec4<f32>(position,1.0);
  var clip=uniforms.viewProjection*worldPosition;
  clip.z=(clip.z+clip.w)*0.5;
  output.position=clip;
  output.worldPosition=worldPosition.xyz;
  let model3=mat3x3<f32>(world[0].xyz,world[1].xyz,world[2].xyz);
  let cofactor0=cross(model3[1],model3[2]);let cofactor1=cross(model3[2],model3[0]);let cofactor2=cross(model3[0],model3[1]);let determinant=dot(model3[0],cofactor0);let inverseDeterminant=select(1.0,1.0/determinant,abs(determinant)>0.0000001);let normalMatrix=mat3x3<f32>(cofactor0,cofactor1,cofactor2)*inverseDeterminant;
  output.normal=normalMatrix*normal;
  let tangentHandedness=select(-1.0,1.0,determinant>=0.0);
  output.tangent=vec4<f32>(model3*tangent.xyz,tangent.w*tangentHandedness);
  output.uv=uv;
  output.uv1=uv1;
  output.color=color${instanced ? '*instanceColor' : ''};
  return output;
}
fn uvSet(input:VertexOutput,index:f32)->vec2<f32>{let uv=select(input.uv,input.uv1,index>0.5);let scaled=uv*uniforms.textureTransform.xy;let c=cos(uniforms.textureRotation.x);let sn=sin(uniforms.textureRotation.x);return vec2<f32>(c*scaled.x-sn*scaled.y,sn*scaled.x+c*scaled.y)+uniforms.textureTransform.zw;}
fn surfaceBasis(input:VertexOutput,basisUv:vec2<f32>,n:vec3<f32>)->mat3x3<f32>{
  let dp1=dpdx(input.worldPosition);let dp2=dpdy(input.worldPosition);let duv1=dpdx(basisUv);let duv2=dpdy(basisUv);var t:vec3<f32>;var b:vec3<f32>;
  if(length(input.tangent.xyz)>0.0001){t=normalize(input.tangent.xyz-n*dot(n,input.tangent.xyz));b=normalize(cross(n,t))*input.tangent.w;}
  else{let dp2perp=cross(dp2,n);let dp1perp=cross(n,dp1);t=dp2perp*duv1.x+dp1perp*duv2.x;b=dp2perp*duv1.y+dp1perp*duv2.y;let basisScale=max(dot(t,t),dot(b,b));if(basisScale>0.0000001){let invmax=inverseSqrt(basisScale);t=t*invmax;b=b*invmax;}else{t=normalize(vec3<f32>(n.z,0.0,-n.x));b=cross(n,t);}}
  return mat3x3<f32>(t,b,n);
}
fn surfaceUv(input:VertexOutput,index:f32,frontFacing:bool)->vec2<f32>{
  let uv=uvSet(input,index);let mode=i32(uniforms.materialParams.x);
  if(index>0.5||uniforms.detailParams.w<=0.0||uniforms.surfaceDetailParams.x<0.5||(mode!=1&&mode!=6)){return uv;}
  var n=normalize(input.normal);if(!frontFacing){n=-n;}let basis=surfaceBasis(input,uv,n);let viewTs=transpose(basis)*normalize(uniforms.cameraPosition.xyz-input.worldPosition);let vz=max(abs(viewTs.z),0.25);let direction=viewTs.xy/vz;
  let h0=textureSample(detailHeightTexture,detailHeightSampler,uv*uniforms.detailParams.x).r-0.5;var h=h0;
  if(uniforms.surfaceDetailParams.x>1.5){let probe=uv-direction*h0*uniforms.detailParams.w;let h1=textureSample(detailHeightTexture,detailHeightSampler,probe*uniforms.detailParams.x).r-0.5;h=(h0+h1)*0.5;}
  return uv-direction*h*uniforms.detailParams.w;
}
fn srgbChannelToLinear(value:f32)->f32{return select(value/12.92,pow((value+0.055)/1.055,2.4),value>0.04045);}
fn srgbToLinear(value:vec3<f32>)->vec3<f32>{return vec3<f32>(srgbChannelToLinear(value.r),srgbChannelToLinear(value.g),srgbChannelToLinear(value.b));}
fn linearChannelToSrgb(value:f32)->f32{let x=clamp(value,0.0,1.0);return select(x*12.92,1.055*pow(x,1.0/2.4)-0.055,x>0.0031308);}
fn linearToSrgb(value:vec3<f32>)->vec3<f32>{return vec3<f32>(linearChannelToSrgb(value.r),linearChannelToSrgb(value.g),linearChannelToSrgb(value.b));}
fn aces(value:vec3<f32>)->vec3<f32>{let a=2.51;let b=0.03;let c=2.43;let d=0.59;let e=0.14;return clamp((value*(a*value+vec3<f32>(b)))/(value*(c*value+vec3<f32>(d))+vec3<f32>(e)),vec3<f32>(0.0),vec3<f32>(1.0));}
fn pbrNeutralToneMap(input:vec3<f32>)->vec3<f32>{
  var color=max(input,vec3<f32>(0.0));let x=min(color.r,min(color.g,color.b));let offset=select(0.04,x-6.25*x*x,x<0.08);color=max(color-vec3<f32>(offset),vec3<f32>(0.0));let peak=max(color.r,max(color.g,color.b));let startCompression=0.76;if(peak<startCompression){return color;}let d=1.0-startCompression;let newPeak=1.0-d*d/(peak+d-startCompression);color=color*(newPeak/max(peak,0.000001));let g=1.0-1.0/(0.15*(peak-newPeak)+1.0);return mix(color,vec3<f32>(newPeak),vec3<f32>(g));
}
fn outputTransform(input:vec3<f32>,position:vec2<f32>)->vec3<f32>{
  var value=max(input*uniforms.outputParams.x,vec3<f32>(0.0));
  let mode=i32(uniforms.outputParams.y);
  if(mode==1){value=value/(vec3<f32>(1.0)+value);}else if(mode==2){value=aces(value);}else if(mode==3){value=clamp(pbrNeutralToneMap(value),vec3<f32>(0.0),vec3<f32>(1.0));}else{value=clamp(value,vec3<f32>(0.0),vec3<f32>(1.0));}
  if(uniforms.outputParams.z>0.5){value=linearToSrgb(value);}
  if(uniforms.outputParams.w>0.5){let noise=fract(sin(dot(position,vec2<f32>(12.9898,78.233)))*43758.5453)-0.5;value=clamp(value+vec3<f32>(noise/255.0),vec3<f32>(0.0),vec3<f32>(1.0));}
  return value;
}
fn applyAtmosphere(input:vec3<f32>,worldPosition:vec3<f32>)->vec3<f32>{
  if(uniforms.atmosphereParams2.w<0.5||uniforms.atmosphereParams.x<0.5){return input;}
  let distanceToCamera=length(uniforms.cameraPosition.xyz-worldPosition);
  var fog:f32;
  if(uniforms.atmosphereParams.x<1.5){fog=smoothstep(uniforms.atmosphereParams.y,uniforms.atmosphereParams.z,distanceToCamera);}else{let scaled=uniforms.atmosphereParams.w*distanceToCamera;fog=1.0-exp(-scaled*scaled);}
  if(uniforms.atmosphereParams2.y>0.0){let height=max(0.0,worldPosition.y-uniforms.atmosphereParams2.x);fog=fog*exp(-height*uniforms.atmosphereParams2.y);}
  fog=clamp(fog,0.0,uniforms.atmosphereParams2.z);
  return mix(input,srgbToLinear(uniforms.atmosphereColor.rgb),vec3<f32>(fog));
}
fn applyColorGrading(input:vec3<f32>,position:vec2<f32>)->vec3<f32>{
  if(uniforms.gradingParams.x<0.5){return max(input,vec3<f32>(0.0));}
  var value=input;let luma=dot(value,vec3<f32>(0.2126,0.7152,0.0722));value=mix(vec3<f32>(luma),value,vec3<f32>(uniforms.gradingParams.y));let pivot=0.18;value=(value-vec3<f32>(pivot))*uniforms.gradingParams.z+vec3<f32>(pivot+uniforms.gradingParams.w);value=value+vec3<f32>(uniforms.gradingParams2.x*0.055,uniforms.gradingParams2.y*0.03,-uniforms.gradingParams2.x*0.055);value=value+vec3<f32>(-uniforms.gradingParams2.y*0.018,0.0,-uniforms.gradingParams2.y*0.018);let highlight=max(dot(value,vec3<f32>(0.2126,0.7152,0.0722))-uniforms.gradingParams3.y,0.0);value=value+value*highlight*uniforms.gradingParams3.x;if(uniforms.gradingParams2.z>0.0){let viewport=max(uniforms.viewportSize.xy,vec2<f32>(1.0));let uv=position/viewport;let centered=uv*2.0-vec2<f32>(1.0);let edge=length(centered*vec2<f32>(viewport.x/viewport.y,1.0));let vignette=smoothstep(max(0.0,1.35-uniforms.gradingParams2.w),1.35,edge)*uniforms.gradingParams2.z;value=value*(1.0-clamp(vignette,0.0,0.92));}return max(value,vec3<f32>(0.0));
}
fn finalizeColor(input:vec3<f32>,worldPosition:vec3<f32>,position:vec2<f32>)->vec3<f32>{return outputTransform(applyColorGrading(applyAtmosphere(input,worldPosition),position),position);}
fn waterFlowDirection()->vec2<f32>{
  let direction=uniforms.waterFlowTime.xy;let lengthSquared=dot(direction,direction);return select(vec2<f32>(1.0,0.0),direction*inverseSqrt(max(lengthSquared,0.0000001)),lengthSquared>0.0000001);
}
fn waterAnimatedUv(uv:vec2<f32>,layer:f32)->vec2<f32>{
  if(i32(uniforms.materialParams.x)!=6||uniforms.waterMotion.y<=0.0||uniforms.waterMotion.z<=0.0){return uv;}
  let flow=waterFlowDirection();let perpendicular=vec2<f32>(-flow.y,flow.x);let alternate=normalize(perpendicular-flow*0.28);let direction=select(alternate,flow,layer<0.5);let directionSign=select(-1.0,1.0,layer<0.5);let rate=select(0.014,0.022,layer<0.5)*uniforms.waterMotion.z;return uv+direction*(uniforms.waterFlowTime.z*rate*directionSign);
}
fn waterMacroNormal(input:VertexOutput,n:vec3<f32>)->vec3<f32>{
  if(i32(uniforms.materialParams.x)!=6||uniforms.waterMotion.y<=0.0){return n;}
  let flow=waterFlowDirection();let perpendicular=vec2<f32>(-flow.y,flow.x);let diagonal=normalize(flow*0.72+perpendicular*0.69);let p=input.worldPosition.xz*max(uniforms.waterMotion.x,0.0001);let t=uniforms.waterFlowTime.z*uniforms.waterMotion.z;let a=dot(p,flow)+t;let b=dot(p*1.83,perpendicular)-t*1.31;let c=dot(p*0.54,diagonal)+t*0.63;let slope=flow*cos(a)*0.50+perpendicular*cos(b)*0.31+diagonal*cos(c)*0.19;return normalize(n+vec3<f32>(-slope.x,0.0,-slope.y)*uniforms.waterMotion.y);
}
fn surfaceNormal(input:VertexOutput,frontFacing:bool)->vec3<f32>{
  var n=normalize(input.normal);
  if(!frontFacing){n=-n;}
  let useBaseNormal=uniforms.textureFlags.z>0.5;
  let useDetailNormal=uniforms.detailParams.y>0.0;
  if(!useBaseNormal&&!useDetailNormal){return waterMacroNormal(input,n);}
  var basisUv=select(surfaceUv(input,0.0,frontFacing),surfaceUv(input,uniforms.textureFlags2.w,frontFacing),useBaseNormal);
  if(useBaseNormal){basisUv=waterAnimatedUv(basisUv,0.0);}
  var mapNormal=vec3<f32>(0.0,0.0,1.0);
  if(useBaseNormal){
    mapNormal=textureSample(normalTexture,normalSampler,basisUv).xyz*2.0-vec3<f32>(1.0);
    mapNormal.x=mapNormal.x*uniforms.materialParams2.x;
    mapNormal.y=mapNormal.y*uniforms.materialParams2.x;
  }
  if(useDetailNormal){
    let detailUv=waterAnimatedUv(surfaceUv(input,0.0,frontFacing)*uniforms.detailParams.x,1.0);
    var detailNormal=textureSample(detailNormalTexture,detailNormalSampler,detailUv).xyz*2.0-vec3<f32>(1.0);
    detailNormal.x=detailNormal.x*uniforms.detailParams.y;detailNormal.y=detailNormal.y*uniforms.detailParams.y;
    mapNormal=normalize(vec3<f32>(mapNormal.xy+detailNormal.xy,mapNormal.z*max(detailNormal.z,0.0001)));
  }
  return waterMacroNormal(input,normalize(surfaceBasis(input,basisUv,n)*mapNormal));
}
fn distributionGGX(n:vec3<f32>,h:vec3<f32>,roughness:f32)->f32{let a=roughness*roughness;let a2=a*a;let ndoth=max(dot(n,h),0.0);let denom=ndoth*ndoth*(a2-1.0)+1.0;return a2/max(PI*denom*denom,0.000001);}
fn geometrySchlickGGX(ndotv:f32,roughness:f32)->f32{let r=roughness+1.0;let k=(r*r)/8.0;return ndotv/max(ndotv*(1.0-k)+k,0.000001);}
fn geometrySmith(n:vec3<f32>,v:vec3<f32>,l:vec3<f32>,roughness:f32)->f32{return geometrySchlickGGX(max(dot(n,v),0.0),roughness)*geometrySchlickGGX(max(dot(n,l),0.0),roughness);}
fn fresnelSchlick(cosTheta:f32,f0:vec3<f32>)->vec3<f32>{return f0+(vec3<f32>(1.0)-f0)*pow(1.0-cosTheta,5.0);}
fn fresnelSchlickRoughness(cosTheta:f32,f0:vec3<f32>,roughness:f32)->vec3<f32>{return f0+(max(vec3<f32>(1.0-roughness),f0)-f0)*pow(1.0-cosTheta,5.0);}
fn evaluateLight(base:vec3<f32>,n:vec3<f32>,v:vec3<f32>,lightDirection:vec3<f32>,lightColor:vec3<f32>,attenuation:f32,metallic:f32,roughness:f32)->vec3<f32>{
  let ndotl=max(dot(n,lightDirection),0.0);if(ndotl<=0.0){return vec3<f32>(0.0);}let h=normalize(lightDirection+v);let ndotv=max(dot(n,v),0.0001);let hdotv=max(dot(h,v),0.0);let dielectricIor=max(1.0,uniforms.glassParams.y);let dielectricF0=pow((dielectricIor-1.0)/(dielectricIor+1.0),2.0);let f0=mix(vec3<f32>(dielectricF0)*srgbToLinear(uniforms.specularColor.rgb)*uniforms.pbrAdvanced.z,base,vec3<f32>(metallic));let f=fresnelSchlick(hdotv,f0);let d=distributionGGX(n,h,roughness);let g=geometrySmith(n,v,lightDirection,roughness);let specular=(d*g*f)/max(4.0*ndotv*ndotl,0.0001);let kd=(vec3<f32>(1.0)-f)*(1.0-metallic);let coatRoughness=clamp(uniforms.pbrAdvanced.y,0.045,1.0);let coatF=fresnelSchlick(hdotv,vec3<f32>(0.04));let coatD=distributionGGX(n,h,coatRoughness);let coatG=geometrySmith(n,v,lightDirection,coatRoughness);let coat=(coatD*coatG*coatF)/max(4.0*ndotv*ndotl,0.0001)*uniforms.pbrAdvanced.x;let sheenF=pow(1.0-hdotv,5.0)*(1.0-uniforms.sheenColor.a*0.5);let sheen=srgbToLinear(uniforms.sheenColor.rgb)*abs(uniforms.pbrAdvanced.w)*sheenF;return (kd*base/PI+specular+coat+sheen)*lightColor*ndotl*attenuation;
}
fn luminance(value:vec3<f32>)->f32{return dot(value,vec3<f32>(0.2126,0.7152,0.0722));}
fn wrappedLambert(ndotl:f32,wrap:f32)->f32{return clamp((ndotl+wrap)/max(1.0+wrap,0.0001),0.0,1.0);}
fn interleavedGradientNoise(position:vec2<f32>)->f32{return fract(52.9829189*fract(dot(position,vec2<f32>(0.06711056,0.00583715))));}
fn environmentUv(direction:vec3<f32>)->vec2<f32>{let d=normalize(direction);let phi=atan2(d.z,d.x)+uniforms.environmentMapParams.z;return vec2<f32>(fract(phi/(2.0*PI)+0.5),acos(clamp(d.y,-1.0,1.0))/PI);}
fn environmentColor(n:vec3<f32>)->vec3<f32>{if(uniforms.environmentMapParams.x>0.5){if(uniforms.environmentIblParams.x>0.5){return textureSampleLevel(environmentDiffuseTexture,environmentDiffuseSampler,environmentUv(n),0.0).rgb*uniforms.environmentMapParams.y;}return textureSampleLevel(environmentTexture,environmentSampler,environmentUv(n),uniforms.environmentIblParams.z).rgb*uniforms.environmentMapParams.y;}let hemisphere=clamp(n.y*0.5+0.5,0.0,1.0);return mix(uniforms.environmentGround.rgb,uniforms.environmentSky.rgb,hemisphere)*uniforms.environmentParams.x;}
fn environmentSpecular(direction:vec3<f32>,roughness:f32)->vec3<f32>{if(uniforms.environmentMapParams.x>0.5){return textureSampleLevel(environmentTexture,environmentSampler,environmentUv(direction),roughness*uniforms.environmentIblParams.z).rgb*uniforms.environmentMapParams.y;}return environmentColor(direction);}
fn environmentBrdf(ndotv:f32,roughness:f32)->vec2<f32>{if(uniforms.environmentIblParams.y>0.5){return textureSampleLevel(environmentBrdfTexture,environmentBrdfSampler,vec2<f32>(clamp(ndotv,0.0,1.0),clamp(roughness,0.0,1.0)),0.0).rg;}let c0=vec4<f32>(-1.0,-0.0275,-0.572,0.022);let c1=vec4<f32>(1.0,0.0425,1.04,-0.04);let r=roughness*c0+c1;let a004=min(r.x*r.x,exp2(-9.28*ndotv))*r.x+r.y;return vec2<f32>(-1.04,1.04)*a004+r.zw;}
fn specularOcclusion(ndotv:f32,ao:f32,roughness:f32)->f32{return clamp(pow(ndotv+ao,exp2(-16.0*roughness-1.0))-1.0+ao,0.0,1.0);}
fn sampleShadowCascade(worldPosition:vec3<f32>,n:vec3<f32>,cascade:u32)->f32{
  let clip=uniforms.shadowMatrices[cascade]*vec4<f32>(worldPosition+n*uniforms.shadowParams.y,1.0);let projected=clip.xyz/max(clip.w,0.00001);let uv=vec2<f32>(projected.x*0.5+0.5,0.5-projected.y*0.5);let depth=projected.z*0.5+0.5-uniforms.shadowParams.x;
  if(uv.x<=0.0||uv.x>=1.0||uv.y<=0.0||uv.y>=1.0||depth<=0.0||depth>=1.0){return 1.0;}
  let size=vec2<f32>(textureDimensions(shadowTexture));let texel=vec2<f32>(1.0)/max(size,vec2<f32>(1.0));let radius=max(0.0,uniforms.shadowParams.z);let layer=i32(cascade);let filterMode=i32(uniforms.shadowQuality.x+0.5);
  if(filterMode==0||radius<0.25){return textureSampleCompareLevel(shadowTexture,shadowSampler,uv,layer,depth);}
  var visible=0.0;var total=0.0;
  if(filterMode==1){for(var y:i32=-1;y<=1;y=y+1){for(var x:i32=-1;x<=1;x=x+1){let w=f32((2-abs(x))*(2-abs(y)));visible=visible+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+vec2<f32>(f32(x),f32(y))*texel*radius,layer,depth)*w;total=total+w;}}}
  else if(filterMode==2){for(var y:i32=-2;y<=2;y=y+1){for(var x:i32=-2;x<=2;x=x+1){let w=f32((3-abs(x))*(3-abs(y)));visible=visible+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+vec2<f32>(f32(x),f32(y))*texel*radius,layer,depth)*w;total=total+w;}}}
  else{let p0=vec2<f32>(-0.61,0.62);let p1=vec2<f32>(0.17,-0.04);let p2=vec2<f32>(-0.30,0.79);let p3=vec2<f32>(0.65,0.49);let p4=vec2<f32>(-0.82,-0.27);let p5=vec2<f32>(-0.71,-0.67);let p6=vec2<f32>(0.98,-0.11);let p7=vec2<f32>(0.06,0.14);let p8=vec2<f32>(0.20,0.21);let p9=vec2<f32>(-0.67,0.33);let p10=vec2<f32>(-0.10,-0.30);let p11=vec2<f32>(0.57,0.61);visible=textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p0*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p1*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p2*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p3*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p4*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p5*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p6*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p7*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p8*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p9*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p10*texel*radius*1.6,layer,depth)+textureSampleCompareLevel(shadowTexture,shadowSampler,uv+p11*texel*radius*1.6,layer,depth);total=12.0;}
  return visible/max(total,1.0);
}
fn shadowVisibility(worldPosition:vec3<f32>,n:vec3<f32>)->f32{
  if(uniforms.shadowParams.w<0.5){return 1.0;}let viewPosition=uniforms.cameraView*vec4<f32>(worldPosition,1.0);let viewDepth=max(0.0,-viewPosition.z);let count=i32(uniforms.shadowCascadeData.x+0.5);var cascade=0u;
  if(count>1&&viewDepth>uniforms.shadowSplits.x){cascade=1u;}if(count>2&&viewDepth>uniforms.shadowSplits.y){cascade=2u;}if(count>3&&viewDepth>uniforms.shadowSplits.z){cascade=3u;}
  let primary=sampleShadowCascade(worldPosition,n,cascade);var result=primary;
  if(i32(cascade)<count-1){var previous=0.0;if(cascade==1u){previous=uniforms.shadowSplits.x;}else if(cascade==2u){previous=uniforms.shadowSplits.y;}else if(cascade==3u){previous=uniforms.shadowSplits.z;}var split=uniforms.shadowSplits.x;if(cascade==1u){split=uniforms.shadowSplits.y;}else if(cascade==2u){split=uniforms.shadowSplits.z;}else if(cascade==3u){split=uniforms.shadowSplits.w;}let width=max(0.0001,split-previous);let blendStart=split-width*uniforms.shadowQuality.y;let blend=smoothstep(blendStart,split,viewDepth);if(blend>0.0){result=mix(primary,sampleShadowCascade(worldPosition,n,cascade+1u),blend);}}
  let fadeStart=uniforms.shadowCascadeData.y*(1.0-uniforms.shadowQuality.z);let fade=1.0-smoothstep(fadeStart,uniforms.shadowCascadeData.y,viewDepth);return mix(1.0,result,fade);
}
@fragment fn fragment_main(input:VertexOutput,@builtin(front_facing) frontFacing:bool)->@location(0) vec4<f32>{
  let tint=uniforms.baseColor;var sampled=vec4<f32>(1.0);if(uniforms.textureFlags.x>0.5){sampled=textureSample(baseColorTexture,baseColorSampler,surfaceUv(input,uniforms.textureFlags2.y,frontFacing));}var surfaceAlpha=tint.a*input.color.a*sampled.a;let coverageNoise=interleavedGradientNoise(input.position.xy);let coverageMode=uniforms.textureCoords.w>0.5;if(uniforms.materialParams.y>0.0){let edge=max(fwidth(surfaceAlpha),1.0/255.0);let coverage=smoothstep(uniforms.materialParams.y-edge,uniforms.materialParams.y+edge,surfaceAlpha);if(coverageMode){surfaceAlpha=coverage;}else{if(coverage<coverageNoise){discard;}surfaceAlpha=1.0;}}else if((uniforms.environmentMapParams.w>0.5||uniforms.pbrAdvanced.w<0.0)&&surfaceAlpha<1.0){if(surfaceAlpha<coverageNoise){discard;}surfaceAlpha=1.0;}var outputAlpha=select(surfaceAlpha,1.0,uniforms.materialParams2.w>0.5&&!coverageMode);let base=srgbToLinear(tint.rgb)*input.color.rgb*sampled.rgb;var color=base;let mode=i32(uniforms.materialParams.x);
  if(mode==4||mode==5){
    let n=surfaceNormal(input,frontFacing);let v=normalize(uniforms.cameraPosition.xyz-input.worldPosition);var rawAo=1.0;if(uniforms.textureFlags2.x>0.5){let sampledAo=textureSample(occlusionTexture,occlusionSampler,surfaceUv(input,uniforms.textureCoords.y,frontFacing)).r;rawAo=mix(1.0,sampledAo,uniforms.materialParams2.y);}let ao=select(rawAo,mix(1.0,rawAo,clamp(uniforms.toonParams3.x,0.0,1.0)),mode==5);let wrap=select(0.0,clamp(uniforms.toonParams3.y,0.0,1.0),mode==5);let giEqualization=select(0.0,clamp(uniforms.mtoonAdvanced2.x,0.0,1.0),mode==5);let giNormal=normalize(mix(n,vec3<f32>(0.0,1.0,0.0),vec3<f32>(giEqualization)));let gi=environmentColor(giNormal);var lightAmount=clamp(luminance(uniforms.ambient.rgb)*0.28+luminance(gi)*0.22,0.0,1.0);var primaryShading=-0.15;var primaryLightDirection=normalize(vec3<f32>(-0.35,0.75,0.55));var lightTint=max(uniforms.ambient.rgb+gi*0.18,vec3<f32>(0.08));
    let directionalLength=length(uniforms.directionalDirection.xyz);if(directionalLength>0.0001){let lightDirection=-uniforms.directionalDirection.xyz/directionalLength;primaryLightDirection=lightDirection;let visibility=shadowVisibility(input.worldPosition,n);let rawDot=dot(n,lightDirection)*visibility;let contribution=select(max(rawDot,0.0),wrappedLambert(rawDot,wrap),mode==5);primaryShading=max(primaryShading,rawDot);lightAmount=lightAmount+contribution*luminance(uniforms.directionalColor.rgb);lightTint=lightTint+uniforms.directionalColor.rgb*contribution;}
    for(var index:u32=0u;index<MAX_POINT_LIGHTS;index=index+1u){if(index>=u32(uniforms.materialParams2.z)){break;}let delta=uniforms.pointPositions[index].xyz-input.worldPosition;let distanceToLight=length(delta);let range=max(uniforms.pointPositions[index].w,0.0001);let attenuation=pow(clamp(1.0-distanceToLight/range,0.0,1.0),max(uniforms.pointColors[index].w,0.0001));let lightDirection=delta/max(distanceToLight,0.0001);let rawDot=dot(n,lightDirection);let contribution=select(max(rawDot,0.0),wrappedLambert(rawDot,wrap),mode==5)*attenuation;if(contribution>lightAmount){primaryLightDirection=lightDirection;}primaryShading=max(primaryShading,rawDot*attenuation);lightAmount=lightAmount+contribution*luminance(uniforms.pointColors[index].rgb);lightTint=lightTint+uniforms.pointColors[index].rgb*contribution;}
    for(var index:u32=0u;index<MAX_SPOT_LIGHTS;index=index+1u){if(index>=u32(uniforms.textureCoords.z)){break;}let delta=uniforms.spotPositions[index].xyz-input.worldPosition;let distanceToLight=length(delta);let lightDirection=delta/max(distanceToLight,0.0001);let range=max(uniforms.spotPositions[index].w,0.0001);let normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);let coneDot=dot(normalize(uniforms.spotDirections[index].xyz),-lightDirection);let cone=smoothstep(uniforms.spotDirections[index].w,uniforms.spotColors[index].w,coneDot);let rawDot=dot(n,lightDirection);let contribution=select(max(rawDot,0.0),wrappedLambert(rawDot,wrap),mode==5)*pow(normalizedDistance,2.0)*cone;primaryShading=max(primaryShading,rawDot*cone);lightAmount=lightAmount+contribution*luminance(uniforms.spotColors[index].rgb);lightTint=lightTint+uniforms.spotColors[index].rgb*contribution;}
    var band=0.0;let shadowTint=srgbToLinear(uniforms.toonShadowColor.rgb);let highlightTint=srgbToLinear(uniforms.toonHighlightColor.rgb);
    if(mode==5){var shifted=primaryShading+uniforms.toonParams2.w;if(uniforms.mtoonAdvanced.x>0.5){var mask=textureSample(faceShadowTexture,faceShadowSampler,uvSet(input,uniforms.mtoonAdvanced.y)).r;if(uniforms.mtoonAdvanced2.w<1.5){shifted=shifted+mask*uniforms.mtoonAdvanced2.z;}else{if(uniforms.mtoonAdvanced.w>0.5){let faceUv=uvSet(input,uniforms.mtoonAdvanced.y);mask=textureSample(faceShadowTexture,faceShadowSampler,vec2<f32>(1.0-faceUv.x,faceUv.y)).r;}shifted=shifted*mix(1.0,mask,uniforms.mtoonAdvanced.z);}}let toony=clamp(uniforms.toonParams.y,0.0,1.0);let lower=-1.0+toony;let upper=1.0-toony;band=smoothstep(lower-0.002,upper+0.002,shifted);var shadeTerm=shadowTint;if(uniforms.textureFlags3.x>0.5){shadeTerm=shadeTerm*textureSample(metallicTexture,metallicSampler,uvSet(input,uniforms.textureCoords.w)).rgb;}let lightingTint=mix(vec3<f32>(1.0),normalize(max(lightTint,vec3<f32>(0.0001))),vec3<f32>(0.12));color=mix(shadeTerm,base,vec3<f32>(band))*lightingTint*ao;let fallbackAxis=select(vec3<f32>(1.0,0.0,0.0),vec3<f32>(v.z,0.0,-v.x),abs(v.y)<0.999);let worldViewX=normalize(fallbackAxis);let worldViewY=normalize(cross(v,worldViewX));let matcapUv=vec2<f32>(dot(worldViewX,n),dot(worldViewY,n))*0.495+vec2<f32>(0.5);var rim=vec3<f32>(0.0);if(uniforms.textureFlags3.y>0.5){rim=rim+srgbToLinear(uniforms.toonHighlightColor.rgb)*textureSample(roughnessTexture,roughnessSampler,matcapUv).rgb;}let parametric=pow(clamp(1.0-dot(n,v)+uniforms.mtoonAdvanced2.y,0.0,1.0),max(uniforms.toonParams2.x,0.0001));rim=rim+srgbToLinear(uniforms.toonRimColor.rgb)*parametric;if(uniforms.lightMapParams.x>0.5){rim=rim*textureSample(lightMapTexture,lightMapSampler,uvSet(input,uniforms.lightMapParams.y)).rgb;}let rimLighting=mix(vec3<f32>(1.0),clamp(lightTint+gi*0.25,vec3<f32>(0.0),vec3<f32>(2.0)),vec3<f32>(clamp(uniforms.toonParams.w,0.0,1.0)));color=color+rim*rimLighting;if(uniforms.toonParams3.z>0.0){let h=normalize(primaryLightDirection+v);let eyeSpec=pow(max(dot(n,h),0.0),64.0)*uniforms.toonParams3.z;color=color+vec3<f32>(eyeSpec)*max(normalize(max(lightTint,vec3<f32>(0.0001))),vec3<f32>(0.7));}if(uniforms.toonParams3.w>0.0){let strand=select(vec3<f32>(0.0,1.0,0.0),normalize(input.tangent.xyz),length(input.tangent.xyz)>0.0001);let h=normalize(primaryLightDirection+v);let sinTH=sqrt(max(0.0,1.0-pow(clamp(dot(strand,h),-1.0,1.0),2.0)));let hairSpec=pow(sinTH,max(2.0,uniforms.toonParams.x))*uniforms.toonParams3.w;color=color+vec3<f32>(hairSpec)*max(normalize(max(lightTint,vec3<f32>(0.0001))),vec3<f32>(0.6));}}
    else{let steps=max(2.0,uniforms.toonParams.x);lightAmount=mix(lightAmount,clamp(lightAmount+luminance(environmentColor(n))*uniforms.toonParams3.z,0.0,1.0),uniforms.toonParams3.z);let shifted=clamp(lightAmount+uniforms.toonParams2.w+uniforms.toonParams3.y,0.0,1.0);let quantized=floor(shifted*(steps-1.0)+0.5)/(steps-1.0);band=mix(quantized,shifted,clamp(uniforms.toonParams3.x,0.0,1.0));let shaded=mix(base,base*shadowTint,vec3<f32>(uniforms.toonParams.y));color=mix(shaded,base,vec3<f32>(band))*mix(vec3<f32>(1.0),normalize(max(lightTint,vec3<f32>(0.0001))),vec3<f32>(0.12))*ao;let highlight=smoothstep(0.72,0.98,band)*uniforms.toonParams.z;color=mix(color,highlightTint,vec3<f32>(highlight));let ndotv=clamp(dot(n,v),0.0,1.0);let rim=pow(1.0-ndotv,uniforms.toonParams2.x)*uniforms.toonParams.w;color=color+srgbToLinear(uniforms.toonRimColor.rgb)*rim;let outline=pow(1.0-abs(dot(n,v)),uniforms.toonParams2.z)*uniforms.toonParams2.y;color=mix(color,srgbToLinear(uniforms.toonOutlineColor.rgb),vec3<f32>(clamp(outline,0.0,1.0)));}
    var emissive=srgbToLinear(uniforms.emissive.rgb);if(uniforms.textureFlags.w>0.5){emissive=emissive*textureSample(emissiveTexture,emissiveSampler,surfaceUv(input,uniforms.textureCoords.x,frontFacing)).rgb;}color=finalizeColor(color+emissive,input.worldPosition,input.position.xy);
  }else if(mode==1){
    let n=surfaceNormal(input,frontFacing);let v=normalize(uniforms.cameraPosition.xyz-input.worldPosition);var metallic=clamp(uniforms.materialParams.z,0.0,1.0);var roughness=clamp(uniforms.materialParams.w,0.045,1.0);
    if(uniforms.textureFlags.y>0.5){let mr=textureSample(metallicRoughnessTexture,metallicRoughnessSampler,surfaceUv(input,uniforms.textureFlags2.z,frontFacing));roughness=roughness*mr.g;metallic=metallic*mr.b;}
    if(uniforms.textureFlags3.x>0.5){metallic=metallic*textureSample(metallicTexture,metallicSampler,surfaceUv(input,uniforms.textureFlags3.z,frontFacing)).r;}
    if(uniforms.textureFlags3.y>0.5){roughness=roughness*textureSample(roughnessTexture,roughnessSampler,surfaceUv(input,uniforms.textureFlags3.w,frontFacing)).r;}
    if(uniforms.detailParams.z>0.0){let detailRoughness=textureSample(detailRoughnessTexture,detailRoughnessSampler,surfaceUv(input,0.0,frontFacing)*uniforms.detailParams.x).r;roughness=mix(roughness,detailRoughness,clamp(uniforms.detailParams.z,0.0,1.0));}
    if(uniforms.surfaceDetailParams.y>0.0){let nx=dpdx(n);let ny=dpdy(n);let variance=max(dot(nx,nx),dot(ny,ny));roughness=sqrt(roughness*roughness+min(variance*uniforms.surfaceDetailParams.y,0.18));}
    metallic=clamp(metallic,0.0,1.0);roughness=clamp(roughness,0.045,1.0);var ao=1.0;if(uniforms.textureFlags2.x>0.5){let sampled=textureSample(occlusionTexture,occlusionSampler,surfaceUv(input,uniforms.textureCoords.y,frontFacing)).r;ao=mix(1.0,sampled,uniforms.materialParams2.y);}
    let env=environmentColor(n);let specularEnvironment=environmentSpecular(reflect(-v,n),roughness);let ndotv=max(dot(n,v),0.0);let dielectricIor=max(1.0,uniforms.glassParams.y);let dielectricF0=pow((dielectricIor-1.0)/(dielectricIor+1.0),2.0);let f0=mix(vec3<f32>(dielectricF0)*srgbToLinear(uniforms.specularColor.rgb)*uniforms.pbrAdvanced.z,base,vec3<f32>(metallic));let envFresnel=fresnelSchlickRoughness(ndotv,f0,roughness);let envKd=(vec3<f32>(1.0)-envFresnel)*(1.0-metallic);let envBrdf=environmentBrdf(ndotv,roughness);let environmentSpecularContribution=specularEnvironment*(f0*envBrdf.x+vec3<f32>(envBrdf.y))*uniforms.environmentParams.y*specularOcclusion(ndotv,ao,roughness);let coatFresnel=pow(1.0-ndotv,5.0);let coatBrdf=environmentBrdf(ndotv,uniforms.pbrAdvanced.y);let coatEnvironment=environmentSpecular(reflect(-v,n),uniforms.pbrAdvanced.y)*(vec3<f32>(0.04)*coatBrdf.x+vec3<f32>(coatBrdf.y))*mix(0.04,1.0,coatFresnel)*uniforms.pbrAdvanced.x*uniforms.environmentParams.y;let sheenEnvironment=srgbToLinear(uniforms.sheenColor.rgb)*abs(uniforms.pbrAdvanced.w)*pow(1.0-ndotv,5.0)*(1.0-uniforms.sheenColor.a*0.5);var lightMapContribution=vec3<f32>(0.0);if(uniforms.lightMapParams.x>0.5){lightMapContribution=textureSample(lightMapTexture,lightMapSampler,uvSet(input,uniforms.lightMapParams.y)).rgb*uniforms.lightMapParams.z;}var lit=base*uniforms.ambient.rgb*ao+envKd*base*env*ao/PI+environmentSpecularContribution+coatEnvironment+sheenEnvironment+base*lightMapContribution;
    let directionalLength=length(uniforms.directionalDirection.xyz);if(directionalLength>0.0001){let lightDirection=-uniforms.directionalDirection.xyz/directionalLength;lit=lit+evaluateLight(base,n,v,lightDirection,uniforms.directionalColor.rgb,shadowVisibility(input.worldPosition,n),metallic,roughness);}
    for(var index:u32=0u;index<MAX_POINT_LIGHTS;index=index+1u){if(index>=u32(uniforms.materialParams2.z)){break;}let delta=uniforms.pointPositions[index].xyz-input.worldPosition;let distanceToLight=length(delta);let range=max(uniforms.pointPositions[index].w,0.0001);let normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);let attenuation=pow(normalizedDistance,max(uniforms.pointColors[index].w,0.0001));lit=lit+evaluateLight(base,n,v,delta/max(distanceToLight,0.0001),uniforms.pointColors[index].rgb,attenuation,metallic,roughness);}
    for(var index:u32=0u;index<MAX_SPOT_LIGHTS;index=index+1u){if(index>=u32(uniforms.textureCoords.z)){break;}let delta=uniforms.spotPositions[index].xyz-input.worldPosition;let distanceToLight=length(delta);let lightDirection=delta/max(distanceToLight,0.0001);let range=max(uniforms.spotPositions[index].w,0.0001);let normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);let coneDot=dot(normalize(uniforms.spotDirections[index].xyz),-lightDirection);let cone=smoothstep(uniforms.spotDirections[index].w,uniforms.spotColors[index].w,coneDot);let attenuation=pow(normalizedDistance,2.0)*cone;lit=lit+evaluateLight(base,n,v,lightDirection,uniforms.spotColors[index].rgb,attenuation,metallic,roughness);}
    var emissive=srgbToLinear(uniforms.emissive.rgb);if(uniforms.textureFlags.w>0.5){emissive=emissive*textureSample(emissiveTexture,emissiveSampler,surfaceUv(input,uniforms.textureCoords.x,frontFacing)).rgb;}color=lit+emissive;
    let transmission=clamp(uniforms.glassParams.x,0.0,1.0);if(transmission>0.0){let ior=max(1.0,uniforms.glassParams.y);let dielectricF0=pow((ior-1.0)/(ior+1.0),2.0);let fresnel=dielectricF0+(1.0-dielectricF0)*pow(1.0-ndotv,5.0);let absorption=pow(max(srgbToLinear(uniforms.attenuationColor.rgb),vec3<f32>(0.0001)),vec3<f32>(max(uniforms.glassParams.z,0.001)/max(uniforms.glassParams.w,0.0001)));let transmitted=mix(base,base*0.82+vec3<f32>(0.18),vec3<f32>(0.18))*(1.0-fresnel)*absorption;let reflected=environmentSpecular(reflect(-v,n),max(0.02,roughness*0.55))*(0.35+fresnel*1.35);color=mix(color,transmitted+reflected,vec3<f32>(transmission));outputAlpha=mix(outputAlpha,clamp(0.08+fresnel*0.86+transmission*0.04,0.08,0.96),transmission);}
    color=finalizeColor(color,input.worldPosition,input.position.xy);
  }else if(mode==6){let n=surfaceNormal(input,frontFacing);let v=normalize(uniforms.cameraPosition.xyz-input.worldPosition);let ndotv=clamp(dot(n,v),0.0,1.0);let legacyFresnel=pow(1.0-ndotv,max(0.5,uniforms.waterParams.x));let dielectricF0=pow((max(1.0,uniforms.glassParams.y)-1.0)/(max(1.0,uniforms.glassParams.y)+1.0),2.0);let physicalFresnel=dielectricF0+(1.0-dielectricF0)*pow(1.0-ndotv,max(0.5,uniforms.waterParams.x));let enhanced=select(0.0,1.0,uniforms.waterMotion.y>0.0001);let fresnel=mix(legacyFresnel,physicalFresnel,enhanced);let depthHint=clamp(1.0-abs(n.y),0.0,1.0);let shallow=srgbToLinear(uniforms.waterShallowColor.rgb);let deep=srgbToLinear(uniforms.waterDeepColor.rgb);let water=mix(shallow,deep,vec3<f32>(clamp(depthHint*uniforms.waterParams.z,0.0,1.0)));let reflection=environmentSpecular(reflect(-v,n),clamp(uniforms.materialParams.w,0.045,1.0));color=mix(water,reflection,vec3<f32>(clamp(fresnel*uniforms.waterParams.y,0.0,1.0)));if(enhanced>0.5&&length(uniforms.directionalDirection.xyz)>0.0001){let l=-normalize(uniforms.directionalDirection.xyz);let ndotl=max(dot(n,l),0.0);if(ndotl>0.0){let h=normalize(l+v);let rough=clamp(uniforms.materialParams.w,0.045,1.0);let d=distributionGGX(n,h,rough);let g=geometrySmith(n,v,l,rough);let f=fresnelSchlick(max(dot(h,v),0.0),vec3<f32>(dielectricF0));let visibility=shadowVisibility(input.worldPosition,n);color=color+(d*g*f/max(4.0*max(ndotv,0.0001)*ndotl,0.0001))*uniforms.directionalColor.rgb*ndotl*visibility*(0.35+uniforms.waterParams.y*0.65);}}let foam=smoothstep(0.72,1.0,1.0-abs(n.y))*uniforms.waterMotion.w;color=mix(color,srgbToLinear(uniforms.waterFoamColor.rgb),vec3<f32>(foam));color=finalizeColor(color+srgbToLinear(uniforms.emissive.rgb),input.worldPosition,input.position.xy);let legacyAlpha=0.82+fresnel*0.18;let transmissionAlpha=0.16+fresnel*0.80;outputAlpha=min(outputAlpha,mix(legacyAlpha,mix(legacyAlpha,transmissionAlpha,clamp(uniforms.glassParams.x,0.0,1.0)),enhanced));
  }else if(mode==0){color=finalizeColor(base,input.worldPosition,input.position.xy);}else if(mode==2){color=surfaceNormal(input,frontFacing)*0.5+vec3<f32>(0.5);}else if(mode==3){color=vec3<f32>(input.position.z/input.position.w);}
  return vec4<f32>(color,outputAlpha);
}
@vertex fn outline_vertex(@location(0) position:vec3<f32>,@location(1) normal:vec3<f32>,@location(2) uv:vec2<f32>,@location(7) uv1:vec2<f32>,@location(8) color:vec4<f32>,@location(9) tangent:vec4<f32>${instanced ? ',@location(3) instance0:vec4<f32>,@location(4) instance1:vec4<f32>,@location(5) instance2:vec4<f32>,@location(6) instance3:vec4<f32>' : ''})->VertexOutput{
  var output:VertexOutput;${instanced ? 'let instanceMatrix=mat4x4<f32>(instance0,instance1,instance2,instance3);let world=uniforms.model*instanceMatrix;' : 'let world=uniforms.model;'}
  let outlineModel3=mat3x3<f32>(world[0].xyz,world[1].xyz,world[2].xyz);let outlineCofactor0=cross(outlineModel3[1],outlineModel3[2]);let outlineCofactor1=cross(outlineModel3[2],outlineModel3[0]);let outlineCofactor2=cross(outlineModel3[0],outlineModel3[1]);let outlineDeterminant=dot(outlineModel3[0],outlineCofactor0);let outlineInverseDeterminant=select(1.0,1.0/outlineDeterminant,abs(outlineDeterminant)>0.0000001);let outlineNormalMatrix=mat3x3<f32>(outlineCofactor0,outlineCofactor1,outlineCofactor2)*outlineInverseDeterminant;let worldNormal=normalize(outlineNormalMatrix*normal);var worldPosition=world*vec4<f32>(position,1.0);var clip=uniforms.viewProjection*worldPosition;let outlineWidth=max(0.0,uniforms.toonParams2.y);if(uniforms.toonParams2.z<1.5){worldPosition=vec4<f32>(worldPosition.xyz+worldNormal*outlineWidth,1.0);clip=uniforms.viewProjection*worldPosition;}else{let projectedNormal=uniforms.viewProjection*vec4<f32>(worldNormal,0.0);let direction=select(vec2<f32>(0.0,1.0),normalize(projectedNormal.xy),length(projectedNormal.xy)>0.00001);clip=vec4<f32>(clip.xy+direction*outlineWidth*2.0*clip.w,clip.z,clip.w);}clip=vec4<f32>(clip.xy,(clip.z+clip.w)*0.5,clip.w);output.position=clip;output.worldPosition=worldPosition.xyz;output.normal=worldNormal;output.uv=uv;output.uv1=uv1;output.color=color;output.tangent=tangent;return output;
}
@fragment fn outline_fragment(input:VertexOutput)->@location(0) vec4<f32>{return vec4<f32>(srgbToLinear(uniforms.toonOutlineColor.rgb),1.0);}
` }

function createShadowShaderSource(instanced: boolean, masked: boolean): string { return `
struct ShadowUniforms {
  model:mat4x4<f32>,
  lightViewProjection:mat4x4<f32>,
  baseColor:vec4<f32>,
  alphaParams:vec4<f32>,
  textureTransform:vec4<f32>,
  textureRotation:vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms:ShadowUniforms;
@group(0) @binding(1) var baseColorSampler:sampler;
@group(0) @binding(2) var baseColorTexture:texture_2d<f32>;
${masked ? `
struct ShadowOutput {
  @builtin(position) position:vec4<f32>,
  @location(0) uv:vec2<f32>,
  @location(1) uv1:vec2<f32>,
  @location(2) color:vec4<f32>,
}
@vertex fn vertex_main(@location(0) position:vec3<f32>,@location(2) uv:vec2<f32>,@location(7) uv1:vec2<f32>,@location(8) color:vec4<f32>${instanced ? ',@location(3) instance0:vec4<f32>,@location(4) instance1:vec4<f32>,@location(5) instance2:vec4<f32>,@location(6) instance3:vec4<f32>,@location(10) instanceColor:vec4<f32>' : ''})->ShadowOutput{
  ${instanced ? 'let instanceMatrix=mat4x4<f32>(instance0,instance1,instance2,instance3);let world=uniforms.model*instanceMatrix;' : 'let world=uniforms.model;'}
  var output:ShadowOutput;var clip=uniforms.lightViewProjection*world*vec4<f32>(position,1.0);clip.z=(clip.z+clip.w)*0.5;output.position=clip;output.uv=uv;output.uv1=uv1;output.color=color${instanced ? '*instanceColor' : ''};return output;
}
fn interleavedGradientNoise(p:vec2<f32>)->f32{return fract(52.9829189*fract(0.06711056*p.x+0.00583715*p.y));}
fn surfaceUv(input:ShadowOutput)->vec2<f32>{var uv=select(input.uv,input.uv1,uniforms.alphaParams.z>0.5);let centered=uv-vec2<f32>(0.5);let c=cos(uniforms.textureRotation.x);let ss=sin(uniforms.textureRotation.x);let rotated=vec2<f32>(c*centered.x-ss*centered.y,ss*centered.x+c*centered.y)+vec2<f32>(0.5);return rotated*uniforms.textureTransform.xy+uniforms.textureTransform.zw;}
@fragment fn fragment_main(input:ShadowOutput){var alpha=uniforms.baseColor.a*input.color.a;if(uniforms.alphaParams.y>0.5){alpha=alpha*textureSample(baseColorTexture,baseColorSampler,surfaceUv(input)).a;}let edge=max(fwidth(alpha),1.0/255.0);let coverage=smoothstep(uniforms.alphaParams.x-edge,uniforms.alphaParams.x+edge,alpha);if(coverage<interleavedGradientNoise(input.position.xy)){discard;}}
` : `
@vertex fn vertex_main(@location(0) position:vec3<f32>${instanced ? ',@location(3) instance0:vec4<f32>,@location(4) instance1:vec4<f32>,@location(5) instance2:vec4<f32>,@location(6) instance3:vec4<f32>' : ''})->@builtin(position) vec4<f32>{
  ${instanced ? 'let instanceMatrix=mat4x4<f32>(instance0,instance1,instance2,instance3);let world=uniforms.model*instanceMatrix;' : 'let world=uniforms.model;'}
  var clip=uniforms.lightViewProjection*world*vec4<f32>(position,1.0);clip.z=(clip.z+clip.w)*0.5;return clip;
}
`}` }





const pointFieldShader = `
struct PointFieldUniforms {
  viewProjection: mat4x4<f32>,
  model: mat4x4<f32>,
  viewportSpace: vec4<f32>,
  outputParams: vec4<f32>,
}
@group(0) @binding(0) var<uniform> u: PointFieldUniforms;
struct VertexInput {
  @location(0) pointPosition: vec3<f32>,
  @location(1) pointColor: vec4<f32>,
  @location(2) appearance: vec2<f32>,
  @builtin(vertex_index) vertexIndex: u32,
}
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) corner: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) intensity: f32,
}
fn cornerForVertex(id: u32) -> vec2<f32> {
  if (id == 0u) { return vec2<f32>(-1.0,-1.0); }
  if (id == 1u) { return vec2<f32>( 1.0,-1.0); }
  if (id == 2u) { return vec2<f32>(-1.0, 1.0); }
  if (id == 3u) { return vec2<f32>(-1.0, 1.0); }
  if (id == 4u) { return vec2<f32>( 1.0,-1.0); }
  return vec2<f32>(1.0,1.0);
}
@vertex fn vertex_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  var clip: vec4<f32>;
  if (u.viewportSpace.z > 0.5) {
    let direction = normalize((u.model * vec4<f32>(input.pointPosition, 0.0)).xyz);
    clip = u.viewProjection * vec4<f32>(direction, 0.0);
    clip.z = clip.w * 0.999999;
  } else {
    clip = u.viewProjection * u.model * vec4<f32>(input.pointPosition, 1.0);
  }
  let corner = cornerForVertex(input.vertexIndex);
  let viewport = max(u.viewportSpace.xy, vec2<f32>(1.0,1.0));
  let sizePx = max(input.appearance.x, 0.35);
  clip.xy += corner * (sizePx * 2.0 / viewport) * clip.w;
  out.position = clip;
  out.corner = corner;
  out.color = input.pointColor;
  out.intensity = max(input.appearance.y, 0.0);
  return out;
}
fn toneMap(color: vec3<f32>, mode: f32) -> vec3<f32> {
  if (mode < 0.5) { return color; }
  if (mode < 1.5) { return color / (vec3<f32>(1.0) + color); }
  let x = max(vec3<f32>(0.0), color - vec3<f32>(0.004));
  return (x * (6.2*x + vec3<f32>(0.5))) / (x * (6.2*x + vec3<f32>(1.7)) + vec3<f32>(0.06));
}
fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0/2.4)) - vec3<f32>(0.055);
  return select(hi, lo, c <= vec3<f32>(0.0031308));
}
@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let radius = length(input.corner);
  let alpha = (1.0 - smoothstep(0.72, 1.0, radius)) * input.color.a;
  if (alpha <= 0.001) { discard; }
  var color = max(input.color.rgb, vec3<f32>(0.0)) * input.intensity * max(u.outputParams.x, 0.0);
  color = toneMap(color, u.outputParams.y);
  if (u.outputParams.z > 0.5) { color = linearToSrgb(color); }
  return vec4<f32>(color, alpha);
}`

export class WebGPURenderer implements RecoverableRenderer {
  readonly backend = 'webgpu' as const
  readonly stats: RendererStats = createRendererStats()
  capabilities: RendererCapabilities = { backend: 'webgpu', maxTextureSize: 0, maxPointLights: 8, maxSpotLights: 4, computeShaders: true, timestampQueries: false, instancing: true, offscreenCanvas: typeof OffscreenCanvas !== 'undefined', features: createRendererFeatures({ xr: false, shadows: true, imageBasedLighting: true }), advanced: createRendererAdvancedCapabilities() }
  width = 1
  height = 1
  pixelRatio = 1
  disposed = false
  colorManagement: RendererColorManagement = resolveColorManagement()
  environmentLighting: RendererEnvironmentLighting = resolveEnvironmentLighting()
  environmentMap: Readonly<RendererEnvironmentMap> | undefined
  shadowOptions: RendererShadowOptions = resolveShadowOptions()
  imageQuality: RendererImageQuality = resolveImageQuality()
  atmosphere: RendererAtmosphere = resolveAtmosphere()
  colorGrading: RendererColorGrading = resolveColorGrading()
  postProcessing: RendererPostProcessing = resolvePostProcessing()
  optimization: RendererOptimizationOptions = resolveOptimization()
  private canvas?: RenderSurface
  private adapter?: GPUAdapter
  private device?: GPUDevice
  private context?: GPUCanvasContext
  private format: GPUTextureFormat = 'bgra8unorm'
  private depthTexture?: GPUTexture
  private multisampleTexture?: GPUTexture
  private postProcessPipeline?: WebGPUPostProcessPipeline
  private lastFrameTime = 0
  private waterTimeSeconds = 0
  private waterLastTimestamp = 0
  private sampleCount = 1
  private bindGroupLayout?: GPUBindGroupLayout
  private pipelineLayout?: GPUPipelineLayout
  private shaderBindGroupLayout?: GPUBindGroupLayout
  private shaderPipelineLayout?: GPUPipelineLayout
  private shadowBindGroupLayout?: GPUBindGroupLayout
  private shadowPipelineLayout?: GPUPipelineLayout
  private readonly shadowPipelines = new Map<string, GPURenderPipeline>()
  private shadowTexture?: GPUTexture
  private shadowTextureView?: GPUTextureView
  private readonly shadowLayerViews: GPUTextureView[] = []
  private shadowSampler?: GPUSampler
  private shadowMapSize = 0
  private shadowGeneration = 0
  private shadowAvailable = false
  private readonly shadowMatrices = [new Matrix4(),new Matrix4(),new Matrix4(),new Matrix4()]
  private readonly shadowSplits = new Float32Array(4)
  private shadowCascadeCount=1
  private shadowCascadeLayers=0
  private readonly shadowUniforms = new Map<Mesh, Map<Material, WebGPUShadowUniform[]>>()
  private readonly pipelines = new Map<string, GPURenderPipeline>()
  private readonly shaderPipelines = new Map<ShaderMaterial, Map<string, GPURenderPipeline>>()
  private readonly geometries = new Map<Geometry, WebGPUGeometry>()
  private readonly uniforms = new Map<Mesh, Map<Material, WebGPUObjectUniform>>()
  private readonly shaderUniforms = new Map<Mesh, Map<ShaderMaterial, WebGPUShaderUniform>>()
  private readonly instances = new Map<InstancedMesh, WebGPUInstances>()
  private readonly textures = new Map<Texture, WebGPUTextureState>()
  private readonly textureResidency = new TextureResidencyManager<Texture>()
  private readonly geometryResidency = new GeometryResidencyManager<Geometry>()
  private readonly renderQueueBuilder = new RenderQueueBuilder()
  private environmentTexture?: WebGPUTextureState
  private environmentDiffuseTexture?: WebGPUTextureState
  private environmentBrdfTexture?: WebGPUTextureState
  private proceduralClouds: RendererProceduralCloudState = resolveProceduralCloudState()
  private cloudNoiseTexture?: WebGPUTextureState
  private cloudNoiseSeed = Number.NaN
  private environmentBackgroundBindGroupLayout?: GPUBindGroupLayout
  private environmentBackgroundPipeline?: GPURenderPipeline
  private environmentBackgroundPipelineSampleCount = 0
  private environmentBackgroundUniformBuffer?: GPUBuffer
  private environmentBackgroundBindGroup?: GPUBindGroup
  private environmentBackgroundBoundTexture?: GPUTexture
  private environmentBackgroundBoundCloudTexture?: GPUTexture
  private readonly environmentBackgroundUniformValues = new Float32Array(68)
  private readonly environmentBackgroundInverseViewProjection = new Matrix4()
  private pointFieldBindGroupLayout?: GPUBindGroupLayout
  private pointFieldPipeline?: GPURenderPipeline
  private pointFieldPipelineSampleCount = 0
  private readonly pointFields = new Map<PointField, WebGPUPointFieldState>()
  private readonly pointFieldUniformValues = new Float32Array(40)
  private whiteTexture?: WebGPUTextureState
  private frameIndex=0
  private occlusionCuller=new HierarchicalDepthCuller(64)
  private clusterGrid=new ClusteredLightGrid()
  private readonly outlinePipelines=new Map<string,GPURenderPipeline>()
  private readonly clearColor = new Color(0.04, 0.045, 0.06, 1)
  private deviceLost = false
  private maxPointLights = 8
  private maxSpotLights = 4
  private diagnostics?: RendererDiagnosticSink
  private readonly reportedDiagnostics = new Set<string>()
  private readonly lightReference = new Vector3()
  private readonly localPointLights: ClusteredPointLight[] = []
  private readonly shadowFrustum = new Frustum()
  private initializationOptions?: RendererOptions
  private timestampQuerySet?: GPUQuerySet
  private timestampResolveBuffer?: GPUBuffer
  private timestampReadBuffer?: GPUBuffer
  private timestampReadPending = false

  static isSupported(): boolean { return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as Navigator).gpu) }

  async initialize(options: RendererOptions): Promise<void> {
    if (this.device) throw new Error('WebGPURenderer is already initialized.')
    this.initializationOptions = { ...options }
    this.colorManagement = resolveColorManagement(options.colorManagement)
    this.environmentLighting = resolveEnvironmentLighting(options.environmentLighting)
    this.shadowOptions = resolveShadowOptions(options.shadows)
    this.imageQuality = resolveImageQuality(options.imageQuality)
    this.atmosphere = resolveAtmosphere(options.atmosphere)
    this.colorGrading = resolveColorGrading(options.colorGrading)
    this.postProcessing = resolvePostProcessing(options.postProcessing)
    this.optimization = resolveOptimization(options.optimization)
    this.textureResidency.budgetBytes=this.optimization.textureMemoryBudgetMB*1024*1024
    this.textureResidency.minimumUnusedFrames=this.optimization.textureEvictionFrames
    this.geometryResidency.budgetBytes=this.optimization.geometryMemoryBudgetMB*1024*1024
    this.geometryResidency.minimumUnusedFrames=this.optimization.geometryEvictionFrames
    this.occlusionCuller=new HierarchicalDepthCuller({baseResolution:this.optimization.hizResolution,historyFrames:this.optimization.occlusionHistoryFrames,minimumProjectedPixels:this.optimization.occlusionMinimumPixels})
    this.clusterGrid=new ClusteredLightGrid({dimensions:this.optimization.clusterDimensions,maxLightsPerCluster:this.optimization.maxLightsPerCluster,maxVisibleLights:this.optimization.maxClusteredLights})
    await this.configureDevice(options)
  }

  async recover(options: RendererRecoveryOptions = {}): Promise<void> {
    if (this.disposed) throw new Error('WebGPURenderer is disposed.')
    const initialization = this.initializationOptions
    if (!initialization || !this.canvas) throw new Error('WebGPURenderer cannot recover before initialization.')
    options.onProgress?.(0.05, 'Releasing lost WebGPU resources')
    this.releaseGpuResources(true)
    this.deviceLost = false
    options.onProgress?.(0.25, 'Requesting a replacement WebGPU device')
    await this.configureDevice({ ...initialization, canvas: this.canvas })
    options.onProgress?.(0.8, 'Recreating render targets')
    this.resize(this.width, this.height, this.pixelRatio)
    options.onProgress?.(1, 'WebGPU recovery complete')
    this.diagnostics?.({
      severity: 'info',
      code: 'SEKAI64_WEBGPU_DEVICE_RECOVERED',
      message: 'The WebGPU device was recreated and resources will be uploaded lazily.',
      details: { backend: this.backend },
    })
  }

  private async configureDevice(options: RendererOptions): Promise<void> {
    if (!WebGPURenderer.isSupported()) throw new Error('WebGPU is unavailable in this environment.')
    const gpu = (navigator as Navigator).gpu
    const platform = ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '')
    const adapterOptions = /windows|win32/i.test(platform)
      ? {}
      : { powerPreference: options.powerPreference ?? 'high-performance' }
    const adapter = await gpu.requestAdapter(adapterOptions)
    if (!adapter) throw new Error('WebGPU could not acquire a compatible adapter.')
    const supportsTimestampQueries = adapter.features?.has?.('timestamp-query') === true
    const device = await adapter.requestDevice(supportsTimestampQueries ? { requiredFeatures: ['timestamp-query'] } : {})
    const context = options.canvas.getContext('webgpu') as GPUCanvasContext | null
    if (!context) { device.destroy(); throw new Error('The canvas could not create a WebGPU context.') }
    this.canvas = options.canvas
    this.maxPointLights = Math.max(0, Math.min(8, Math.floor(options.maxPointLights ?? 8)))
    this.maxSpotLights = Math.max(0, Math.min(4, Math.floor(options.maxSpotLights ?? 4)))
    this.diagnostics = options.diagnostics
    this.adapter = adapter
    this.device = device
    this.context = context
    this.format = gpu.getPreferredCanvasFormat()
    this.sampleCount = options.antialias === false || this.postProcessing.enabled ? 1 : this.imageQuality.msaaSamples
    this.bindGroupLayout = device.createBindGroupLayout({ label: 'Sekai64 object resources', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 7, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 9, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 10, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 11, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 12, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 13, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 14, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 15, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      { binding: 16, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', viewDimension: '2d-array' } },
      { binding: 17, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 18, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 19, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 20, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 21, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 22, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 23, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 24, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 25, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 26, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 27, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 28, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 29, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 30, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 31, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 32, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } }
    ] })
    this.pipelineLayout = device.createPipelineLayout({ label: 'Sekai64 pipeline layout', bindGroupLayouts: [this.bindGroupLayout] })
    this.shaderBindGroupLayout = device.createBindGroupLayout({ label: 'Sekai64 ShaderMaterial resources', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ] })
    this.shaderPipelineLayout = device.createPipelineLayout({ label: 'Sekai64 ShaderMaterial pipeline layout', bindGroupLayouts: [this.shaderBindGroupLayout] })
    this.shadowBindGroupLayout = device.createBindGroupLayout({ label: 'Sekai64 shadow object resources', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
    ] })
    this.shadowPipelineLayout = device.createPipelineLayout({ label: 'Sekai64 shadow pipeline layout', bindGroupLayouts: [this.shadowBindGroupLayout] })
    this.whiteTexture = createWhiteTexture(device)
    if (this.environmentMap) this.environmentTexture = this.uploadEnvironmentMap(this.environmentMap)
    if (this.proceduralClouds.enabled) this.ensureCloudNoiseTexture()
    this.postProcessPipeline = new WebGPUPostProcessPipeline(device)
    if (supportsTimestampQueries && device.features?.has?.('timestamp-query') === true) {
      this.timestampQuerySet = device.createQuerySet({ type: 'timestamp', count: 2, label: 'Sekai64 frame timestamps' })
      this.timestampResolveBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC, label: 'Sekai64 timestamp resolve' })
      this.timestampReadBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, label: 'Sekai64 timestamp readback' })
    }
    this.ensureShadowResources()
    this.capabilities = {
      ...this.capabilities,
      maxTextureSize: adapter.limits.maxTextureDimension2D,
      maxPointLights: this.maxPointLights,
      maxSpotLights: this.maxSpotLights,
      timestampQueries: device.features.has('timestamp-query'),
      features: createRendererFeatures({ xr: false, spotLights: true, automaticRecovery: true, shadows: true, environmentMaps: true, hdrEnvironment: true, imageBasedLighting: true, gpuPostProcessing: true, ssao: true, bloom: true, outlines: true, cascadedShadows: true, mipmapGeneration: true, gtao: true, bloomPyramid: true, invertedHullOutlines: true, fxaa: true, faceShadowMaps: true, transparentHair: true, hizOcclusion: true, clusteredLighting: true, staticBatching: true, textureStreaming: true, colorLuts: true, prefilteredEnvironmentMaps: true }),
    }
    context.configure({ device, format: this.format, alphaMode: options.alpha ? 'premultiplied' : 'opaque' })
    void device.lost.then(info => {
      if (this.device !== device || this.disposed) return
      this.deviceLost = true
      const diagnostic = {
        severity: 'error' as const,
        code: 'SEKAI64_WEBGPU_DEVICE_LOST',
        message: `The WebGPU device was lost (${info.reason}).`,
        details: { backend: this.backend, reason: info.reason, message: info.message },
      }
      if (this.diagnostics) this.diagnostics(diagnostic)
      else console.error(`Sekai64 WebGPU device lost (${info.reason}): ${info.message}`)
    })
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.assertReady()
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.pixelRatio = Math.max(0.25, pixelRatio)
    const outputWidth = Math.max(1, Math.round(this.width * this.pixelRatio * this.imageQuality.renderScale))
    const outputHeight = Math.max(1, Math.round(this.height * this.pixelRatio * this.imageQuality.renderScale))
    if (this.canvas) { this.canvas.width = outputWidth; this.canvas.height = outputHeight }
    this.depthTexture?.destroy()
    this.multisampleTexture?.destroy()
    this.depthTexture = this.device?.createTexture({ label: 'Sekai64 depth texture', size: [outputWidth, outputHeight, 1], sampleCount: this.sampleCount, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT })
    this.multisampleTexture = this.sampleCount > 1 ? this.device?.createTexture({ label: 'Sekai64 MSAA texture', size: [outputWidth, outputHeight, 1], sampleCount: this.sampleCount, format: this.format, usage: GPUTextureUsage.RENDER_ATTACHMENT }) : undefined
  }
  setClearColor(color: ColorInput): void { this.clearColor.set(color) }
  setColorManagement(value: Partial<RendererColorManagement>): void { this.colorManagement = resolveColorManagement({ ...this.colorManagement, ...value }) }
  setEnvironmentLighting(value: Partial<RendererEnvironmentLighting>): void { this.environmentLighting = resolveEnvironmentLighting({ ...this.environmentLighting, ...value }) }
  setEnvironmentMap(environment: RendererEnvironmentMap | undefined): void { this.environmentMap=environment?{...environment,pixels:environment.pixels,mipLevels:environment.mipLevels?.map(level=>({...level,pixels:level.pixels})),diffuse:environment.diffuse?{...environment.diffuse,pixels:environment.diffuse.pixels}:undefined,brdfLut:environment.brdfLut?{...environment.brdfLut,pixels:environment.brdfLut.pixels}:undefined}:undefined;this.releaseEnvironmentTexture();if(environment&&this.device)this.environmentTexture=this.uploadEnvironmentMap(environment) }
  setProceduralClouds(clouds: RendererProceduralCloudInput | undefined): void { this.proceduralClouds=resolveProceduralCloudState(clouds??{enabled:false});if(!this.proceduralClouds.enabled){this.releaseCloudNoiseTexture();return}if(this.device)this.ensureCloudNoiseTexture() }
  setShadowOptions(value: Partial<RendererShadowOptions>): void {
    const next = resolveShadowOptions({ ...this.shadowOptions, ...value })
    if (next.mapSize !== this.shadowOptions.mapSize || next.cascades !== this.shadowOptions.cascades) this.releaseShadowResources()
    this.shadowOptions = next
  }
  setImageQuality(value: Partial<RendererImageQuality>): void {
    const previous=this.imageQuality;this.imageQuality=resolveImageQuality({ ...this.imageQuality, ...value })
    const nextSamples=this.postProcessing.enabled?1:this.imageQuality.msaaSamples
    const samplesChanged=nextSamples!==this.sampleCount
    if(samplesChanged){this.sampleCount=nextSamples;this.pipelines.clear();this.shaderPipelines.clear();this.outlinePipelines.clear();this.shadowPipelines.clear();this.pointFieldPipeline=undefined;this.pointFieldPipelineSampleCount=0}
    if(previous.renderScale!==this.imageQuality.renderScale||samplesChanged)this.resize(this.width,this.height,this.pixelRatio)
  }
  setAtmosphere(value: Partial<RendererAtmosphere>): void { this.atmosphere = resolveAtmosphere({ ...this.atmosphere, ...value }) }
  setColorGrading(value: Partial<RendererColorGrading>): void { this.colorGrading = resolveColorGrading({ ...this.colorGrading, ...value }) }
  setPostProcessing(value: Partial<RendererPostProcessing>): void {
    const wasEnabled=this.postProcessing.enabled;this.postProcessing=resolvePostProcessing({ ...this.postProcessing, ...value })
    const nextSamples=this.postProcessing.enabled?1:this.imageQuality.msaaSamples
    if(nextSamples!==this.sampleCount||wasEnabled!==this.postProcessing.enabled){this.sampleCount=nextSamples;this.pipelines.clear();this.shaderPipelines.clear();this.outlinePipelines.clear();this.pointFieldPipeline=undefined;this.pointFieldPipelineSampleCount=0;this.resize(this.width,this.height,this.pixelRatio)}
  }
  setOptimization(value: Partial<RendererOptimizationOptions>): void {
    const previous=this.optimization
    this.optimization=resolveOptimization({...this.optimization,...value})
    this.textureResidency.budgetBytes=this.optimization.textureMemoryBudgetMB*1024*1024
    this.textureResidency.minimumUnusedFrames=this.optimization.textureEvictionFrames
    this.geometryResidency.budgetBytes=this.optimization.geometryMemoryBudgetMB*1024*1024
    this.geometryResidency.minimumUnusedFrames=this.optimization.geometryEvictionFrames
    if(previous.hizResolution!==this.optimization.hizResolution||previous.occlusionHistoryFrames!==this.optimization.occlusionHistoryFrames||previous.occlusionMinimumPixels!==this.optimization.occlusionMinimumPixels)this.occlusionCuller=new HierarchicalDepthCuller({baseResolution:this.optimization.hizResolution,historyFrames:this.optimization.occlusionHistoryFrames,minimumProjectedPixels:this.optimization.occlusionMinimumPixels})
    this.clusterGrid=new ClusteredLightGrid({dimensions:this.optimization.clusterDimensions,maxLightsPerCluster:this.optimization.maxLightsPerCluster,maxVisibleLights:this.optimization.maxClusteredLights})
  }

  render(scene: Scene, camera: Camera): void {
    const frameStart=now()
    this.assertReady()
    if (this.deviceLost) return
    this.advanceWaterClock()
    const device = this.device as GPUDevice
    const context = this.context as GPUCanvasContext
    if (!this.depthTexture) this.resize(this.width, this.height, this.pixelRatio)
    resetStats(this.stats);this.stats.renderScale=this.imageQuality.renderScale
    this.collectDisposedResources()
    const transform=scene.updateWorldMatrixTracked()
    this.stats.transformNodesVisited=transform.visited;this.stats.transformNodesUpdated=transform.updated;this.stats.transformSubtreesSkipped=transform.skippedSubtrees
    camera.updateViewport(this.width, this.height)
    camera.updateMatrices()
    this.frameIndex+=1
    if(this.optimization.hizOcclusion)this.occlusionCuller.beginFrame(camera,this.width,this.height)
    const queue=this.renderQueueBuilder.build(scene,camera,this.optimization,this.optimization.hizOcclusion?this.occlusionCuller:undefined,this.height)
    this.stats.renderQueueBuildMs=queue.buildMs;this.stats.renderQueueSortMs=queue.sortMs;this.stats.boundsCacheHits=queue.boundsCacheHits;this.stats.boundsCacheMisses=queue.boundsCacheMisses
    this.stats.renderItemAllocations=queue.itemAllocations
    this.stats.renderItemPoolSize=queue.itemPoolSize
    this.stats.staticBatches=queue.staticBatches
    this.stats.lodSwitches=queue.lodSwitches;this.stats.lodLevelCounts=[...queue.lodLevelCounts]
    const lightBudget=this.optimization.clusteredLighting?this.optimization.maxClusteredLights:this.maxPointLights
    const lightStarted=now()
    const lights=collectSceneLights(scene,lightBudget,this.lightReference.setFromMatrixPosition(camera.worldMatrix),this.maxSpotLights)
    if(this.optimization.clusteredLighting)this.clusterGrid.build(camera,lights.pointLights)
    this.stats.lightGridBuildMs=now()-lightStarted
    this.reportLightLimits(lights)
    this.stats.culledObjects=queue.culled;this.stats.frustumCulledObjects=queue.frustumCulled;this.stats.occlusionCulledObjects=queue.occlusionCulled;this.stats.occlusionCandidates=queue.occlusionCandidates
    const clusterStats=this.clusterGrid.stats
    this.stats.clusterCount=this.optimization.clusteredLighting?clusterStats.clusterCount:0;this.stats.clusteredLightReferences=this.optimization.clusteredLighting?clusterStats.assignedLightReferences:0
    this.stats.clusterOverflows=this.optimization.clusteredLighting?clusterStats.overflowReferences:0;this.stats.maxClusterLights=this.optimization.clusteredLighting?clusterStats.maximumClusterOccupancy:0
    this.stats.visibleLights=this.optimization.clusteredLighting?clusterStats.visibleLights:lights.pointLights.length;this.stats.rejectedLights=this.optimization.clusteredLighting?clusterStats.rejectedLights:Math.max(0,lights.pointCount-lights.pointLights.length)
    const shadowCasters = this.shadowOptions.enabled && lights.directionalSource?.castShadow
      ? this.renderQueueBuilder.buildShadowCasters(scene, this.optimization)
      : queue.opaque
    const encoder = device.createCommandEncoder({ label: 'Sekai64 frame encoder' })
    this.writeGpuTimestamp(encoder, 0)
    this.ensureShadowResources()
    const shadowStarted=now();this.renderShadowPass(encoder, shadowCasters, lights, camera);this.stats.shadowPassMs=now()-shadowStarted
    const currentView = context.getCurrentTexture().createView()
    const outputWidth=Math.max(1,Math.round(this.width*this.pixelRatio*this.imageQuality.renderScale))
    const outputHeight=Math.max(1,Math.round(this.height*this.pixelRatio*this.imageQuality.renderScale))
    const usePostProcess=this.postProcessing.enabled&&Boolean(this.postProcessPipeline)
    if(usePostProcess)this.postProcessPipeline?.ensure(outputWidth,outputHeight,this.format)
    const colorView = usePostProcess ? (this.postProcessPipeline as WebGPUPostProcessPipeline).targetColorView : this.multisampleTexture?.createView() ?? currentView
    const depthView = usePostProcess ? (this.postProcessPipeline as WebGPUPostProcessPipeline).targetDepthView : (this.depthTexture as GPUTexture).createView()
    const colorAttachment: Record<string, unknown> = { view: colorView, clearValue: { r: this.clearColor.r, g: this.clearColor.g, b: this.clearColor.b, a: this.clearColor.a }, loadOp: 'clear', storeOp: usePostProcess||this.sampleCount===1 ? 'store' : 'discard' }
    if (!usePostProcess&&this.sampleCount > 1) colorAttachment.resolveTarget = currentView
    const mainStarted=now()
    const pass = encoder.beginRenderPass({ label: 'Sekai64 main pass', colorAttachments: [colorAttachment], depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } })
    this.drawEnvironmentBackground(pass, camera)
    this.drawPointFields(pass, scene, camera, 'directional', outputWidth, outputHeight)
    let activePipeline: GPURenderPipeline | undefined
    let worldPointFieldsDrawn = false
    for (const [itemIndex, item] of [...queue.opaque, ...queue.transparent].entries()) {
      if (!worldPointFieldsDrawn && itemIndex === queue.opaque.length) { this.drawPointFields(pass, scene, camera, 'world', outputWidth, outputHeight); activePipeline = undefined; worldPointFieldsDrawn = true }
      const mesh = item.mesh
      const material = item.material
      if (material instanceof ShaderMaterial) {
        const pipeline = this.getShaderPipeline(mesh, material)
        if (!pipeline) continue
        const geometry = this.getGeometry(mesh.geometry)
        const uniform = this.getShaderUniform(mesh, material)
        writeShaderUniformValues(uniform.values, mesh, camera, this.lightReference, this.width, this.height, this.pixelRatio, material.uniforms.values())
        device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
      this.stats.uniformUpdates += 1
        if (pipeline !== activePipeline) { pass.setPipeline(pipeline); activePipeline = pipeline; this.stats.pipelineChanges += 1 }
        pass.setBindGroup(0, uniform.bindGroup)
        this.stats.bindGroupChanges += 1
        this.bindGeometry(pass, geometry)
        if (geometry.indexed && geometry.indexBuffer) { pass.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat); pass.drawIndexed(item.count, 1, item.start) }
        else pass.draw(item.count, 1, item.start)
        this.stats.drawCalls += 1; this.stats.visibleObjects += 1; this.stats.triangles += item.count / 3
        continue
      }
      const surface = materialSurface(material)
      if (!surface) continue
      const geometry = this.getGeometry(mesh.geometry)
      const textureStates=[surface.baseColor,surface.metallicRoughness,surface.normal,surface.emissiveTexture,surface.occlusion,surface.metallic,surface.roughness,surface.faceShadow].map(binding=>binding.texture?.ready?this.getTexture(binding.texture):this.whiteTexture as WebGPUTextureState);textureStates.push(this.environmentTexture??this.whiteTexture as WebGPUTextureState);textureStates.push(surface.lightMap.texture?.ready?this.getTexture(surface.lightMap.texture):this.whiteTexture as WebGPUTextureState);textureStates.push(this.environmentDiffuseTexture??this.environmentTexture??this.whiteTexture as WebGPUTextureState);textureStates.push(this.environmentBrdfTexture??this.whiteTexture as WebGPUTextureState);textureStates.push(surface.detailNormal.texture?.ready?this.getTexture(surface.detailNormal.texture):this.whiteTexture as WebGPUTextureState);textureStates.push(surface.detailRoughness.texture?.ready?this.getTexture(surface.detailRoughness.texture):this.whiteTexture as WebGPUTextureState);textureStates.push(surface.detailHeight.texture?.ready?this.getTexture(surface.detailHeight.texture):this.whiteTexture as WebGPUTextureState)
      const uniform = this.getUniform(mesh, material, textureStates)
      this.reportUnsupportedMaterial(mesh, material)
      const alphaCoverage = surface.alphaCutoff > 0 && this.sampleCount > 1 && !material.transparent
      const pipeline = this.getPipeline(material.transparent, material.side, material.depthWrite, mesh instanceof InstancedMesh, alphaCoverage)
      const localPointLights=this.optimization.clusteredLighting?this.clusterGrid.selectForBounds(item.worldBounds,this.localPointLights,this.maxPointLights):copyPointLights(lights.pointLights,this.localPointLights,this.maxPointLights)
      uniform.values.fill(0)
      uniform.values.set(mesh.worldMatrix.elements, 0)
      uniform.values.set(camera.viewProjectionMatrix.elements, 16)
      uniform.values.set([surface.color.r, surface.color.g, surface.color.b, surface.color.a], 32)
      uniform.values.set([surface.emissive[0], surface.emissive[1], surface.emissive[2], 0], 36)
      uniform.values.set([...lights.ambient, 0], 40)
      uniform.values.set([...lights.directionalColor, 0], 44)
      uniform.values.set([...lights.directionalDirection, 0], 48)
      uniform.values.set([this.lightReference.x, this.lightReference.y, this.lightReference.z, 0], 52)
      uniform.values.set([surface.mode, surface.alphaCutoff, surface.metallicFactor, surface.roughnessFactor], 56)
      uniform.values.set([surface.normalScale, surface.occlusionStrength, localPointLights.length, surface.forceOpaqueAlpha ? 1 : 0], 60)
      uniform.values.set([surface.baseColor.texture?.ready ? 1 : 0, surface.metallicRoughness.texture?.ready ? 1 : 0, surface.normal.texture?.ready ? 1 : 0, surface.emissiveTexture.texture?.ready ? 1 : 0], 64)
      uniform.values.set([surface.occlusion.texture?.ready ? 1 : 0, surface.baseColor.texCoord, surface.metallicRoughness.texCoord, surface.normal.texCoord], 68)
      uniform.values.set([surface.emissiveTexture.texCoord, surface.occlusion.texCoord, lights.selectedSpotCount, alphaCoverage ? 1 : 0], 72)
      uniform.values.set([surface.metallic.texture?.ready ? 1 : 0, surface.roughness.texture?.ready ? 1 : 0, surface.metallic.texCoord, surface.roughness.texCoord], 76)
      const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : this.colorManagement.toneMapping === 'neutral' ? 3 : 2
      uniform.values.set([this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, this.imageQuality.dithering ? 1 : 0], 80)
      const hasSceneEnvironment = lights.environmentSky.some(value => value > 0) || lights.environmentGround.some(value => value > 0)
      const environmentSky = hasSceneEnvironment ? lights.environmentSky : linearColor(this.environmentLighting.skyColor)
      const environmentGround = hasSceneEnvironment ? lights.environmentGround : linearColor(this.environmentLighting.groundColor)
      const environmentIntensity = this.environmentLighting.enabled ? (hasSceneEnvironment ? 1 : this.environmentLighting.intensity) : 0
      const environmentSpecular = this.environmentLighting.enabled ? (hasSceneEnvironment ? lights.environmentSpecular : this.environmentLighting.specularIntensity) : 0
      uniform.values.set([...environmentSky, 0], 84)
      uniform.values.set([...environmentGround, 0], 88)
      uniform.values.set([environmentIntensity, environmentSpecular, 0, 0], 92)
      uniform.values.set([surface.transmission, surface.ior, surface.thickness, surface.attenuationDistance], 96)
      uniform.values.set([...surface.attenuationColor, 0], 100)
      uniform.values.set([this.shadowOptions.bias, this.shadowOptions.normalBias, this.shadowOptions.softness, this.shadowAvailable && mesh.receiveShadow ? 1 : 0], 104)
      uniform.values.set(camera.viewMatrix.elements, 108)
      uniform.values.set(surface.toonParams, 124)
      uniform.values.set(surface.toonParams2, 128)
      uniform.values.set([...surface.toonShadowColor, 0], 132)
      uniform.values.set([...surface.toonHighlightColor, 0], 136)
      uniform.values.set([...surface.toonRimColor, 0], 140)
      uniform.values.set([...surface.toonOutlineColor, 0], 144)
      for (let index = 0; index < localPointLights.length; index += 1) {
        const light = localPointLights[index]
        if (!light) continue
        uniform.values.set(light.positionRange, 148 + index * 4)
        uniform.values.set(light.colorDecay, 180 + index * 4)
      }
      for (let index = 0; index < lights.spotLights.length; index += 1) {
        const light = lights.spotLights[index]
        if (!light) continue
        uniform.values.set(light.positionRange, 212 + index * 4)
        uniform.values.set(light.directionOuter, 228 + index * 4)
        uniform.values.set(light.colorInnerDecay, 244 + index * 4)
      }
      const fogMode = this.atmosphere.mode === 'linear' ? 1 : this.atmosphere.mode === 'exp2' ? 2 : 0
      uniform.values.set([...this.atmosphere.color, 0], 260)
      uniform.values.set([fogMode, this.atmosphere.near, this.atmosphere.far, this.atmosphere.density], 264)
      uniform.values.set([this.atmosphere.baseHeight, this.atmosphere.heightFalloff, this.atmosphere.maxOpacity, this.atmosphere.enabled ? 1 : 0], 268)
      uniform.values.set([this.colorGrading.enabled ? 1 : 0, this.colorGrading.saturation, this.colorGrading.contrast, this.colorGrading.brightness], 272)
      uniform.values.set([this.colorGrading.temperature, this.colorGrading.tint, this.colorGrading.vignette, this.colorGrading.vignetteSoftness], 276)
      uniform.values.set([this.colorGrading.highlightGlow, this.colorGrading.highlightThreshold, 0, 0], 280)
      uniform.values.set([this.width*this.pixelRatio*this.imageQuality.renderScale,this.height*this.pixelRatio*this.imageQuality.renderScale,0,0],284)
      for(let cascade=0;cascade<4;cascade+=1)uniform.values.set((this.shadowMatrices[cascade] as Matrix4).elements,288+cascade*16)
      uniform.values.set([this.shadowCascadeCount,this.shadowOptions.maxDistance,this.shadowOptions.splitLambda,this.shadowOptions.stabilize?1:0],352)
      uniform.values.set(this.shadowSplits,356)
      uniform.values.set([surface.faceShadow.texture?.ready?1:0,surface.faceShadow.texCoord,surface.faceShadowStrength,surface.faceShadowFlipX?1:0],360)
      uniform.values.set([this.environmentTexture?1:0,this.environmentMap?.intensity??this.environmentLighting.intensity,this.environmentMap?.rotation??this.environmentLighting.rotation,surface.hairAlphaDither?1:0],364)
      uniform.values.set([surface.clearcoat,surface.clearcoatRoughness,surface.specularFactor,surface.alphaDither?-surface.sheenIntensity:surface.sheenIntensity],368)
      uniform.values.set([...surface.specularColor,0],372)
      uniform.values.set([...surface.sheenColor,surface.sheenRoughness],376)
      uniform.values.set(surface.waterParams,380)
      uniform.values.set([...surface.waterShallowColor,0],384)
      uniform.values.set([...surface.waterDeepColor,0],388)
      uniform.values.set([...surface.waterFoamColor,0],392)
      uniform.values.set(surface.toonParams3,396)
      uniform.values.set(surface.mtoonAdvanced2,400)
      uniform.values.set([surface.lightMap.texture?.ready?1:0,surface.lightMap.texCoord,surface.lightMapIntensity,0],404)
      const shadowFilter=this.shadowOptions.filter==='hard'?0:this.shadowOptions.filter==='pcf3'?1:this.shadowOptions.filter==='pcf5'?2:3
      uniform.values.set([shadowFilter,this.shadowOptions.cascadeBlend,this.shadowOptions.distanceFade,0],408)
      const environmentMaxLod=this.environmentMap?.mipLevels?.length??(this.environmentTexture?Math.max(0,this.environmentTexture.mipLevelCount-1):0)
      uniform.values.set([this.environmentDiffuseTexture?1:0,this.environmentBrdfTexture?1:0,environmentMaxLod,0],412)
      uniform.values.set([surface.textureScale[0],surface.textureScale[1],surface.textureOffset[0],surface.textureOffset[1]],416)
      uniform.values.set([surface.textureRotation,0,0,0],420)
      uniform.values.set([surface.detailScale,surface.detailNormal.texture?.ready?surface.detailNormalStrength:0,surface.detailRoughness.texture?.ready?surface.detailRoughnessStrength:0,surface.detailHeight.texture?.ready?surface.detailHeightScale:0],424)
      const surfaceDetailLevel=this.imageQuality.surfaceDetail==='off'?0:this.imageQuality.surfaceDetail==='high'?2:1
      uniform.values.set([surfaceDetailLevel,surfaceDetailLevel===0?0:surfaceDetailLevel===2?0.4:0.25,0,0],428)
      uniform.values.set(surface.waterMotion,432)
      uniform.values.set([surface.waterFlow[0],surface.waterFlow[1],this.waterTimeSeconds,0],436)
      device.queue.writeBuffer(uniform.buffer, 0, uniform.values)
      this.stats.uniformUpdates += 1
      if(material instanceof StandardMaterial&&!material.transparent&&material.shadingModel==='mtoon'&&material.mtoonOutlineWidth>0&&this.postProcessing.outlines.enabled&&(this.postProcessing.outlines.mode==='inverted-hull'||this.postProcessing.outlines.mode==='hybrid')){const outlinePipeline=this.getOutlinePipeline(mesh instanceof InstancedMesh);if(outlinePipeline!==activePipeline){pass.setPipeline(outlinePipeline);activePipeline=outlinePipeline;this.stats.pipelineChanges+=1}pass.setBindGroup(0,uniform.bindGroup);this.bindGeometry(pass,geometry);const outlineInstances=mesh instanceof InstancedMesh?mesh.drawCount:1;if(mesh instanceof InstancedMesh)pass.setVertexBuffer(6,this.getInstances(mesh).matrixBuffer);if(geometry.indexed&&geometry.indexBuffer){pass.setIndexBuffer(geometry.indexBuffer,geometry.indexFormat);pass.drawIndexed(item.count,outlineInstances,item.start)}else pass.draw(item.count,outlineInstances,item.start);this.stats.drawCalls+=1;this.stats.triangles+=(item.count/3)*outlineInstances}
      if (pipeline !== activePipeline) { pass.setPipeline(pipeline); activePipeline = pipeline; this.stats.pipelineChanges += 1 }
      pass.setBindGroup(0, uniform.bindGroup)
      this.stats.bindGroupChanges += 1
      this.bindGeometry(pass, geometry)
      const instanceCount = mesh instanceof InstancedMesh ? mesh.drawCount : 1
      if (mesh instanceof InstancedMesh) { const instances=this.getInstances(mesh); pass.setVertexBuffer(6, instances.matrixBuffer); pass.setVertexBuffer(7, instances.colorBuffer) }
      if (geometry.indexed && geometry.indexBuffer) { pass.setIndexBuffer(geometry.indexBuffer, geometry.indexFormat); pass.drawIndexed(item.count, instanceCount, item.start) }
      else pass.draw(item.count, instanceCount, item.start)
      this.stats.drawCalls += 1; this.stats.visibleObjects += 1; this.stats.triangles += (item.count / 3) * instanceCount;this.stats.materialChanges+=1
      if(mesh instanceof InstancedMesh){this.stats.instancedDrawCalls+=1;this.stats.instancesRendered+=instanceCount}
    }
    if (!worldPointFieldsDrawn) this.drawPointFields(pass, scene, camera, 'world', outputWidth, outputHeight)
    pass.end()
    this.stats.mainPassMs=now()-mainStarted
    const postStarted=now()
    if(usePostProcess){this.postProcessPipeline?.composite(encoder,currentView,this.postProcessing,this.imageQuality,this.colorGrading);this.stats.postProcessPasses+=this.postProcessPipeline?.lastPassCount??1}
    this.stats.postProcessMs=now()-postStarted
    const residencyStarted=now();this.stats.textureEvictions+=this.textureResidency.enforce(this.frameIndex);this.stats.geometryEvictions += this.geometryResidency.enforce(this.frameIndex);this.stats.residencyMs=now()-residencyStarted
    this.writeGpuTimestamp(encoder, 1)
    const readbackScheduled = this.resolveGpuTimestamps(encoder)
    device.queue.submit([encoder.finish()])
    if (readbackScheduled) this.readGpuTimestamps(device)
    updateFrameStats(this.stats,frameStart,this.lastFrameTime);this.lastFrameTime=frameStart
  }

  private drawPointFields(pass: GPURenderPassEncoder, scene: Scene, camera: Camera, space: 'world' | 'directional', viewportWidth: number, viewportHeight: number): void {
    const device = this.device as GPUDevice
    const pipeline = this.getPointFieldPipeline()
    let active = false
    scene.traverse(node => {
      if (!(node instanceof PointField) || !node.worldVisible || node.disposed || node.space !== space || node.count === 0) return
      const state = this.getPointField(node)
      const values = this.pointFieldUniformValues
      values.fill(0)
      values.set(camera.viewProjectionMatrix.elements, 0)
      values.set(node.worldMatrix.elements, 16)
      values.set([Math.max(1, viewportWidth), Math.max(1, viewportHeight), node.space === 'directional' ? 1 : 0, 0], 32)
      const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : 2
      values.set([this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, 0], 36)
      device.queue.writeBuffer(state.uniformBuffer, 0, values)
      if (!active) { pass.setPipeline(pipeline); this.stats.pipelineChanges += 1; active = true }
      pass.setBindGroup(0, state.bindGroup)
      pass.setVertexBuffer(0, state.positionBuffer)
      pass.setVertexBuffer(1, state.colorBuffer)
      pass.setVertexBuffer(2, state.appearanceBuffer)
      pass.draw(6, state.count)
      this.stats.uniformUpdates += 1
      this.stats.bindGroupChanges += 1
      this.stats.drawCalls += 1
      this.stats.visibleObjects += 1
      this.stats.triangles += state.count * 2
      this.stats.instancesRendered += state.count
      this.stats.instancedDrawCalls += 1
    })
  }

  private getPointFieldPipeline(): GPURenderPipeline {
    const device = this.device as GPUDevice
    if (!this.pointFieldBindGroupLayout) {
      this.pointFieldBindGroupLayout = device.createBindGroupLayout({ label: 'Sekai64 point field resources', entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ] })
      this.stats.gpuResourceCreations += 1; this.stats.gpuResourceCreationsThisFrame += 1
    }
    if (!this.pointFieldPipeline || this.pointFieldPipelineSampleCount !== this.sampleCount) {
      const module = device.createShaderModule({ label: 'Sekai64 point field shader', code: pointFieldShader })
      const layout = device.createPipelineLayout({ label: 'Sekai64 point field pipeline layout', bindGroupLayouts: [this.pointFieldBindGroupLayout] })
      this.pointFieldPipeline = device.createRenderPipeline({
        label: 'Sekai64 point field pipeline', layout,
        vertex: { module, entryPoint: 'vertex_main', buffers: [
          { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] },
          { arrayStride: 8, stepMode: 'instance', attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
        ] },
        fragment: { module, entryPoint: 'fragment_main', targets: [{ format: this.format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' },
        multisample: { count: this.sampleCount },
      })
      this.pointFieldPipelineSampleCount = this.sampleCount
      this.stats.shaderCompilations += 1; this.stats.gpuResourceCreations += 3; this.stats.gpuResourceCreationsThisFrame += 3
    }
    return this.pointFieldPipeline
  }

  private getPointField(field: PointField): WebGPUPointFieldState {
    const cached = this.pointFields.get(field)
    if (cached && cached.version === field.pointVersion) return cached
    const device = this.device as GPUDevice
    if (!this.pointFieldBindGroupLayout) this.getPointFieldPipeline()
    const appearance = new Float32Array(field.count * 2)
    for (let index = 0; index < field.count; index += 1) { appearance[index * 2] = field.sizes[index] ?? 1; appearance[index * 2 + 1] = field.intensities[index] ?? 1 }

    if (cached && cached.count === field.count) {
      device.queue.writeBuffer(cached.positionBuffer, 0, field.positions)
      device.queue.writeBuffer(cached.colorBuffer, 0, field.colors)
      device.queue.writeBuffer(cached.appearanceBuffer, 0, appearance)
      cached.version = field.pointVersion
      this.stats.geometryUploads += 3
      return cached
    }

    if (cached) {
      cached.positionBuffer.destroy(); cached.colorBuffer.destroy(); cached.appearanceBuffer.destroy(); cached.uniformBuffer.destroy()
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - cached.bytes)
    }
    const positionBuffer = createBuffer(device, field.positions, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, `Sekai64 point field positions: ${field.id}`)
    const colorBuffer = createBuffer(device, field.colors, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, `Sekai64 point field colors: ${field.id}`)
    const appearanceBuffer = createBuffer(device, appearance, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, `Sekai64 point field appearance: ${field.id}`)
    const uniformBuffer = device.createBuffer({ label: `Sekai64 point field uniforms: ${field.id}`, size: this.pointFieldUniformValues.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const bindGroup = device.createBindGroup({ label: `Sekai64 point field bind group: ${field.id}`, layout: this.pointFieldBindGroupLayout as GPUBindGroupLayout, entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] })
    const bytes = field.positions.byteLength + field.colors.byteLength + appearance.byteLength + this.pointFieldUniformValues.byteLength
    const state = { positionBuffer, colorBuffer, appearanceBuffer, uniformBuffer, bindGroup, count: field.count, version: field.pointVersion, bytes }
    this.pointFields.set(field, state)
    this.stats.geometryMemory += bytes
    this.stats.geometryUploads += 3
    this.stats.gpuResourceCreations += 5; this.stats.gpuResourceCreationsThisFrame += 5
    return state
  }

  private ensureCloudNoiseTexture(): WebGPUTextureState | undefined {
    const device = this.device
    if (!device || !this.proceduralClouds.enabled) return undefined
    if (this.cloudNoiseTexture && this.cloudNoiseSeed === this.proceduralClouds.seed) return this.cloudNoiseTexture
    this.releaseCloudNoiseTexture()
    const size = 128
    const pixels = createProceduralCloudNoise(this.proceduralClouds.seed, size)
    const texture = device.createTexture({
      label: 'Sekai64 procedural cloud noise',
      size: [size, size, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    device.queue.writeTexture({ texture }, pixels, { bytesPerRow: size * 4, rowsPerImage: size }, [size, size, 1])
    const view = texture.createView()
    const sampler = device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear' })
    const state: WebGPUTextureState = { texture, view, sampler, version: 1, bytes: pixels.byteLength, width: size, height: size, format: 'rgba8unorm', mipLevelCount: 1, lastUsedFrame: this.frameIndex }
    this.cloudNoiseTexture = state
    this.cloudNoiseSeed = this.proceduralClouds.seed
    this.environmentBackgroundBindGroup = undefined
    this.environmentBackgroundBoundCloudTexture = undefined
    this.stats.textureMemory += state.bytes
    this.stats.textureUploads += 1
    this.stats.gpuResourceCreations += 2
    this.stats.gpuResourceCreationsThisFrame += 2
    return state
  }

  private releaseCloudNoiseTexture(): void {
    if (!this.cloudNoiseTexture) { this.cloudNoiseSeed = Number.NaN; return }
    this.cloudNoiseTexture.texture.destroy()
    this.stats.textureMemory = Math.max(0, this.stats.textureMemory - this.cloudNoiseTexture.bytes)
    this.cloudNoiseTexture = undefined
    this.cloudNoiseSeed = Number.NaN
    this.environmentBackgroundBindGroup = undefined
    this.environmentBackgroundBoundCloudTexture = undefined
  }

  private drawEnvironmentBackground(pass: GPURenderPassEncoder, camera: Camera): void {
    const environment = this.environmentMap
    const texture = this.environmentTexture
    if (!environment?.background || !texture) return
    const device = this.device as GPUDevice
    if (!this.environmentBackgroundBindGroupLayout) {
      this.environmentBackgroundBindGroupLayout = device.createBindGroupLayout({ label: 'Sekai64 environment background resources', entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      ] })
      this.environmentBackgroundUniformBuffer = device.createBuffer({ label: 'Sekai64 environment background uniforms', size: 272, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
      this.stats.gpuResourceCreations += 2; this.stats.gpuResourceCreationsThisFrame += 2
    }
    if (!this.environmentBackgroundPipeline || this.environmentBackgroundPipelineSampleCount !== this.sampleCount) {
      const module = device.createShaderModule({ label: 'Sekai64 environment background shader', code: environmentBackgroundShader })
      const layout = device.createPipelineLayout({ label: 'Sekai64 environment background layout', bindGroupLayouts: [this.environmentBackgroundBindGroupLayout] })
      this.environmentBackgroundPipeline = device.createRenderPipeline({ label: 'Sekai64 environment background pipeline', layout, vertex: { module, entryPoint: 'background_vertex' }, fragment: { module, entryPoint: 'background_fragment', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' }, multisample: { count: this.sampleCount } })
      this.environmentBackgroundPipelineSampleCount = this.sampleCount
      this.stats.shaderCompilations += 1; this.stats.gpuResourceCreations += 3; this.stats.gpuResourceCreationsThisFrame += 3
    }
    const cloudNoise = this.proceduralClouds.enabled ? this.ensureCloudNoiseTexture() : undefined
    const cloudTextureState = cloudNoise ?? this.whiteTexture as WebGPUTextureState
    if (!this.environmentBackgroundBindGroup || this.environmentBackgroundBoundTexture !== texture.texture || this.environmentBackgroundBoundCloudTexture !== cloudTextureState.texture) {
      this.environmentBackgroundBindGroup = device.createBindGroup({ label: 'Sekai64 environment background bind group', layout: this.environmentBackgroundBindGroupLayout, entries: [
        { binding: 0, resource: { buffer: this.environmentBackgroundUniformBuffer as GPUBuffer } },
        { binding: 1, resource: texture.sampler },
        { binding: 2, resource: texture.view },
        { binding: 3, resource: cloudTextureState.sampler },
        { binding: 4, resource: cloudTextureState.view },
      ] })
      this.environmentBackgroundBoundTexture = texture.texture
      this.environmentBackgroundBoundCloudTexture = cloudTextureState.texture
      this.stats.bindGroupChanges += 1; this.stats.gpuResourceCreations += 1; this.stats.gpuResourceCreationsThisFrame += 1
    }
    this.environmentBackgroundInverseViewProjection.copy(camera.viewProjectionMatrix).invert()
    const values = this.environmentBackgroundUniformValues
    values.set(this.environmentBackgroundInverseViewProjection.elements, 0)
    const cameraElements = camera.worldMatrix.elements
    values.set([cameraElements[12] ?? 0, cameraElements[13] ?? 0, cameraElements[14] ?? 0, 0], 16)
    values.set([environment.backgroundIntensity ?? 1, environment.rotation ?? 0, environment.format === 'rgba16f-linear' ? 1 : 0, 0], 20)
    const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : this.colorManagement.toneMapping === 'neutral' ? 3 : 2
    values.set([this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, 0], 24)
    const clouds = this.proceduralClouds
    values.set([clouds.enabled ? 1 : 0, clouds.coverage, clouds.density, clouds.scale], 28)
    values.set([clouds.offset[0], clouds.offset[1], clouds.evolution, 0], 32)
    values.set([clouds.sunDirection[0], clouds.sunDirection[1], clouds.sunDirection[2], clouds.sunIntensity], 36)
    values.set([clouds.macroScale, clouds.detailScale, clouds.detailStrength, clouds.warpStrength], 40)
    values.set([clouds.edgeSoftness, clouds.horizonVisibility, clouds.horizonSoftness, clouds.silverLiningStrength], 44)
    values.set([clouds.shadowStrength, clouds.highlightStrength, clouds.horizonExtension, clouds.horizonCompression], 48)
    values.set([clouds.detailOffset[0], clouds.detailOffset[1], clouds.detailEvolution, clouds.horizonAtmosphericFade], 52)
    values.set([clouds.ambientColor[0], clouds.ambientColor[1], clouds.ambientColor[2], 0], 56)
    values.set([clouds.shadowColor[0], clouds.shadowColor[1], clouds.shadowColor[2], 0], 60)
    values.set([clouds.lightColor[0], clouds.lightColor[1], clouds.lightColor[2], 0], 64)
    device.queue.writeBuffer(this.environmentBackgroundUniformBuffer as GPUBuffer, 0, values)
    pass.setPipeline(this.environmentBackgroundPipeline)
    pass.setBindGroup(0, this.environmentBackgroundBindGroup)
    pass.draw(3)
    this.stats.uniformUpdates += 1; this.stats.bindGroupChanges += 1; this.stats.pipelineChanges += 1; this.stats.drawCalls += 1; this.stats.triangles += 1
  }

  private advanceWaterClock(): void {
    const timestamp=now();const delta=this.waterLastTimestamp>0?Math.min(0.25,Math.max(0,(timestamp-this.waterLastTimestamp)/1000)):0;this.waterLastTimestamp=timestamp;this.waterTimeSeconds=(this.waterTimeSeconds+delta)%4096
  }

  private renderShadowPass(encoder: GPUCommandEncoder, items: readonly RenderItem[], lights: ReturnType<typeof collectSceneLights>, camera: Camera): void {
    this.shadowAvailable=false
    if(!this.shadowOptions.enabled||!lights.directionalSource?.castShadow)return
    this.stats.shadowedLights=1
    let hasCaster=false
    for(const item of items){if(item.mesh.castShadow&&!item.material.transparent){hasCaster=true;break}}
    if(!hasCaster)return
    const frames=createDirectionalShadowCascades(camera,lights.directionalDirection,this.shadowOptions)
    if(frames.length===0)return
    this.shadowCascadeCount=frames.length;this.shadowSplits.fill(this.shadowOptions.maxDistance)
    for(const frame of frames){this.shadowMatrices[frame.index]?.copy(frame.matrix);this.shadowSplits[frame.index]=frame.splitFar}
    this.ensureShadowResources()
    if(!this.shadowTexture)return
    const device=this.device as GPUDevice
    for(const frame of frames){
      const shadowFrustum=this.shadowFrustum.setFromProjectionMatrix(frame.matrix)
      const layerView=this.shadowLayerViews[frame.index]
      if(!layerView)continue
      const pass=encoder.beginRenderPass({label:`Sekai64 directional shadow cascade ${frame.index}`,colorAttachments:[],depthStencilAttachment:{view:layerView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}})
      let activePipeline:GPURenderPipeline|undefined
      for(const item of items){
        const mesh=item.mesh
        if(!mesh.castShadow||item.material.transparent)continue
        if(this.optimization.shadowCasterCulling&&!shadowFrustum.intersectsBox(item.worldBounds))continue
        const surface=materialSurface(item.material)
        const masked=Boolean(surface&&surface.alphaCutoff>0)
        const doubleSided=item.material.side==='double'
        const pipeline=this.getShadowPipeline(mesh instanceof InstancedMesh,masked,doubleSided)
        const geometry=this.getGeometry(mesh.geometry)
        const textureState=surface?.baseColor.texture?.ready?this.getTexture(surface.baseColor.texture):this.whiteTexture as WebGPUTextureState
        const uniform=this.getShadowUniform(mesh,item.material,frame.index,textureState)
        uniform.values.fill(0);uniform.values.set(mesh.worldMatrix.elements,0);uniform.values.set(frame.matrix.elements,16)
        uniform.values.set([surface?.color.r??1,surface?.color.g??1,surface?.color.b??1,surface?.color.a??1],32)
        uniform.values.set([surface?.alphaCutoff??0,surface?.baseColor.texture?.ready?1:0,surface?.baseColor.texCoord??0,0],36)
        uniform.values.set([surface?.textureScale[0]??1,surface?.textureScale[1]??1,surface?.textureOffset[0]??0,surface?.textureOffset[1]??0],40)
        uniform.values.set([surface?.textureRotation??0,0,0,0],44)
        device.queue.writeBuffer(uniform.buffer,0,uniform.values);this.stats.uniformUpdates+=1
        if(pipeline!==activePipeline){pass.setPipeline(pipeline);activePipeline=pipeline;this.stats.pipelineChanges+=1}
        pass.setBindGroup(0,uniform.bindGroup);this.stats.bindGroupChanges+=1
        pass.setVertexBuffer(0,geometry.positionBuffer)
        let instanceSlot=1
        if(masked){pass.setVertexBuffer(1,geometry.uvBuffer);pass.setVertexBuffer(2,geometry.uv1Buffer);pass.setVertexBuffer(3,geometry.colorBuffer);instanceSlot=4}
        const instanceCount=mesh instanceof InstancedMesh?mesh.drawCount:1
        if(mesh instanceof InstancedMesh){const instances=this.getInstances(mesh);pass.setVertexBuffer(instanceSlot,instances.matrixBuffer);if(masked)pass.setVertexBuffer(instanceSlot+1,instances.colorBuffer)}
        if(geometry.indexed&&geometry.indexBuffer){pass.setIndexBuffer(geometry.indexBuffer,geometry.indexFormat);pass.drawIndexed(item.count,instanceCount,item.start)}else pass.draw(item.count,instanceCount,item.start)
        this.stats.drawCalls+=1;this.stats.shadowDrawCalls+=1;this.stats.triangles+=(item.count/3)*instanceCount
        if(mesh instanceof InstancedMesh){this.stats.instancedDrawCalls+=1;this.stats.instancesRendered+=instanceCount}
      }
      pass.end()
    }
    this.shadowAvailable=true
  }

  private bindGeometry(pass: GPURenderPassEncoder, geometry: WebGPUGeometry): void {
    pass.setVertexBuffer(0, geometry.positionBuffer)
    pass.setVertexBuffer(1, geometry.normalBuffer)
    pass.setVertexBuffer(2, geometry.uvBuffer)
    pass.setVertexBuffer(3, geometry.uv1Buffer)
    pass.setVertexBuffer(4, geometry.colorBuffer)
    pass.setVertexBuffer(5, geometry.tangentBuffer)
  }

  private writeGpuTimestamp(encoder: GPUCommandEncoder, index: number): void {
    const querySet = this.timestampQuerySet
    if (!querySet || this.timestampReadPending) return
    const timestampEncoder = encoder as GPUCommandEncoder & { writeTimestamp?: (querySet: GPUQuerySet, queryIndex: number) => void }
    timestampEncoder.writeTimestamp?.(querySet, index)
  }

  private resolveGpuTimestamps(encoder: GPUCommandEncoder): boolean {
    if (!this.timestampQuerySet || !this.timestampResolveBuffer || !this.timestampReadBuffer || this.timestampReadPending) return false
    encoder.resolveQuerySet(this.timestampQuerySet, 0, 2, this.timestampResolveBuffer, 0)
    encoder.copyBufferToBuffer(this.timestampResolveBuffer, 0, this.timestampReadBuffer, 0, 16)
    this.timestampReadPending = true
    return true
  }

  private readGpuTimestamps(device: GPUDevice): void {
    const buffer = this.timestampReadBuffer
    if (!buffer) { this.timestampReadPending = false; return }
    void device.queue.onSubmittedWorkDone().then(async () => {
      if (this.disposed || this.timestampReadBuffer !== buffer) return
      await buffer.mapAsync(GPUMapMode.READ)
      const values = new BigUint64Array(buffer.getMappedRange().slice(0))
      buffer.unmap()
      const start = values[0]
      const end = values[1]
      if (start !== undefined && end !== undefined && end >= start) this.stats.gpuFrameMs = Number(end - start) / 1_000_000
    }).catch(() => {
      this.stats.gpuFrameMs = null
    }).finally(() => {
      this.timestampReadPending = false
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseGpuResources(true)
    this.device = undefined
    this.adapter = undefined
    this.context = undefined
    this.canvas = undefined
    this.whiteTexture = undefined
    this.initializationOptions = undefined
  }

  private releaseGpuResources(destroyDevice: boolean): void {
    this.postProcessPipeline?.dispose();this.postProcessPipeline=undefined
    this.timestampQuerySet?.destroy();this.timestampResolveBuffer?.destroy();this.timestampReadBuffer?.destroy()
    this.timestampQuerySet=undefined;this.timestampResolveBuffer=undefined;this.timestampReadBuffer=undefined;this.timestampReadPending=false
    this.releaseShadowResources()
    this.releaseEnvironmentTexture()
    this.releaseCloudNoiseTexture()
    this.environmentBackgroundUniformBuffer?.destroy(); this.environmentBackgroundUniformBuffer=undefined; this.environmentBackgroundBindGroup=undefined; this.environmentBackgroundBindGroupLayout=undefined; this.environmentBackgroundPipeline=undefined; this.environmentBackgroundPipelineSampleCount=0; this.environmentBackgroundBoundTexture=undefined; this.environmentBackgroundBoundCloudTexture=undefined
    for (const field of this.pointFields.values()) { field.positionBuffer.destroy(); field.colorBuffer.destroy(); field.appearanceBuffer.destroy(); field.uniformBuffer.destroy() }
    this.pointFields.clear(); this.pointFieldBindGroupLayout=undefined; this.pointFieldPipeline=undefined; this.pointFieldPipelineSampleCount=0
    for (const geometry of this.geometries.values()) { geometry.positionBuffer.destroy(); geometry.normalBuffer.destroy(); geometry.uvBuffer.destroy(); geometry.uv1Buffer.destroy(); geometry.colorBuffer.destroy(); geometry.tangentBuffer.destroy(); geometry.indexBuffer?.destroy() }
    for (const uniforms of this.uniforms.values()) for (const uniform of uniforms.values()) uniform.buffer.destroy()
    for (const uniforms of this.shaderUniforms.values()) for (const uniform of uniforms.values()) uniform.buffer.destroy()
    for (const materials of this.shadowUniforms.values()) for (const cascades of materials.values()) for (const uniform of cascades) uniform?.buffer.destroy()
    for (const instance of this.instances.values()) { instance.matrixBuffer.destroy(); instance.colorBuffer.destroy() }
    for (const texture of this.textures.values()) texture.texture.destroy()
    this.whiteTexture?.texture.destroy()
    this.depthTexture?.destroy()
    this.multisampleTexture?.destroy()
    if (destroyDevice) this.device?.destroy()
    this.geometries.clear(); this.uniforms.clear(); this.shaderUniforms.clear(); this.shadowUniforms.clear(); this.instances.clear(); this.textures.clear(); this.pipelines.clear(); this.shaderPipelines.clear(); this.outlinePipelines.clear(); this.shadowPipelines.clear(); this.textureResidency.clear();this.geometryResidency.clear()
    this.stats.geometryMemory = 0; this.stats.textureMemory = 0
    this.depthTexture = undefined; this.multisampleTexture = undefined; this.bindGroupLayout = undefined; this.pipelineLayout = undefined; this.shaderBindGroupLayout = undefined; this.shaderPipelineLayout = undefined; this.shadowBindGroupLayout = undefined; this.shadowPipelineLayout = undefined; this.whiteTexture = undefined
    this.device = undefined; this.adapter = undefined
  }

  private getGeometry(geometry: Geometry): WebGPUGeometry {
    const cached = this.geometries.get(geometry)
    if (cached?.version === geometry.version) { this.geometryResidency.touch(geometry,cached.bytes,this.frameIndex,()=>this.evictGeometry(geometry,cached));this.stats.geometryCacheHits+=1;return cached }
    this.stats.geometryCacheMisses+=1
    if (cached) {
      cached.positionBuffer.destroy()
      cached.normalBuffer.destroy()
      cached.uvBuffer.destroy()
      cached.uv1Buffer.destroy()
      cached.colorBuffer.destroy()
      cached.tangentBuffer.destroy()
      cached.indexBuffer?.destroy()
      this.geometries.delete(geometry)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - cached.bytes)
    }
    const device = this.device as GPUDevice
    const vertexCount = geometry.positions.length / 3
    const normals = geometry.normals ?? new Float32Array(geometry.positions.length)
    const uvs = geometry.uvs ?? new Float32Array(vertexCount * 2)
    const uvs1 = geometry.uvs1 ?? new Float32Array(vertexCount * 2)
    const colors = geometry.colors ?? createDefaultColors(vertexCount)
    const tangents = geometry.tangents ?? new Float32Array(vertexCount * 4)
    const positionBuffer = createBuffer(device, geometry.positions, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} positions`)
    const normalBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} normals`)
    const uvBuffer = createBuffer(device, uvs, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} uv0`)
    const uv1Buffer = createBuffer(device, uvs1, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} uv1`)
    const colorBuffer = createBuffer(device, colors, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} colors`)
    const tangentBuffer = createBuffer(device, tangents, GPUBufferUsage.VERTEX, `${geometry.label ?? 'geometry'} tangents`)
    const indexBuffer = geometry.indices ? createBuffer(device, geometry.indices, GPUBufferUsage.INDEX, `${geometry.label ?? 'geometry'} indices`) : undefined
    const bytes = geometry.positions.byteLength + normals.byteLength + uvs.byteLength + uvs1.byteLength + colors.byteLength + tangents.byteLength + (geometry.indices?.byteLength ?? 0)
    const gpu: WebGPUGeometry = { positionBuffer, normalBuffer, uvBuffer, uv1Buffer, colorBuffer, tangentBuffer, version: geometry.version, count: geometry.indices?.length ?? vertexCount, indexed: Boolean(geometry.indices), indexFormat: geometry.indices instanceof Uint32Array ? 'uint32' : 'uint16', bytes, ...(indexBuffer ? { indexBuffer } : {}) }
    this.geometries.set(geometry, gpu)
    this.stats.geometryMemory += bytes
    this.stats.geometryUploads += 1
    this.stats.gpuResourceCreations += 6 + (indexBuffer ? 1 : 0)
    this.stats.gpuResourceCreationsThisFrame += 6 + (indexBuffer ? 1 : 0)
    this.geometryResidency.touch(geometry,bytes,this.frameIndex,()=>this.evictGeometry(geometry,gpu))
    return gpu
  }

  private evictGeometry(geometry: Geometry, gpu: WebGPUGeometry): void {
    if (this.geometries.get(geometry) !== gpu) return
    gpu.positionBuffer.destroy();gpu.normalBuffer.destroy();gpu.uvBuffer.destroy();gpu.uv1Buffer.destroy();gpu.colorBuffer.destroy();gpu.tangentBuffer.destroy();gpu.indexBuffer?.destroy()
    this.geometries.delete(geometry)
    this.stats.geometryMemory=Math.max(0,this.stats.geometryMemory-gpu.bytes)
  }

  private getInstances(mesh: InstancedMesh): WebGPUInstances {
    let state = this.instances.get(mesh)
    if (!state) {
      const matrixBuffer = createBuffer(this.device as GPUDevice, mesh.instanceMatrices, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, `Sekai64 instance matrices: ${mesh.id}`)
      const colorBuffer = createBuffer(this.device as GPUDevice, mesh.instanceColors, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, `Sekai64 instance colors: ${mesh.id}`)
      state = { matrixBuffer, colorBuffer, matrixVersion: mesh.instanceVersion, colorVersion: mesh.instanceColorVersion, bytes: mesh.instanceMatrices.byteLength + mesh.instanceColors.byteLength }
      this.instances.set(mesh, state)
      this.stats.geometryMemory += state.bytes
      this.stats.geometryUploads += 2
      this.stats.gpuResourceCreations += 2
      this.stats.gpuResourceCreationsThisFrame += 2
      return state
    }
    if (state.matrixVersion !== mesh.instanceVersion) {
      ;(this.device as GPUDevice).queue.writeBuffer(state.matrixBuffer, 0, mesh.instanceMatrices)
      state.matrixVersion = mesh.instanceVersion
      this.stats.geometryUploads += 1
    }
    if (state.colorVersion !== mesh.instanceColorVersion) {
      ;(this.device as GPUDevice).queue.writeBuffer(state.colorBuffer, 0, mesh.instanceColors)
      state.colorVersion = mesh.instanceColorVersion
      this.stats.geometryUploads += 1
    }
    return state
  }

  private getTexture(texture: Texture): WebGPUTextureState {
    const cached = this.textures.get(texture)
    if(cached?.version===texture.version){cached.lastUsedFrame=this.frameIndex;this.textureResidency.touch(texture,cached.bytes,this.frameIndex,()=>this.evictTexture(texture,cached));this.stats.textureCacheHits+=1;return cached}
    this.stats.textureCacheMisses+=1
    const device = this.device as GPUDevice
    if (!texture.image && !texture.dataSource) return this.whiteTexture as WebGPUTextureState
    if (texture.width > this.capabilities.maxTextureSize || texture.height > this.capabilities.maxTextureSize) throw new Error(`Texture ${texture.width}×${texture.height} exceeds WebGPU maxTextureSize ${this.capabilities.maxTextureSize}.`)
    const format: GPUTextureFormat = texture.colorSpace === 'srgb' || texture.dataSource?.format === 'rgba8unorm-srgb' ? 'rgba8unorm-srgb' : 'rgba8unorm'
    const canReuseStorage = cached !== undefined
      && cached.width === texture.width
      && cached.height === texture.height
      && cached.format === format
      && cached.mipLevelCount === textureMipLevelCount(texture, this.imageQuality.mipmaps)
    if (canReuseStorage) {
      uploadTexture(device, cached.texture, texture)
      if (cached.mipLevelCount > 1 && !(texture.dataSource?.mipLevels?.length)) {
        generateWebGpuMipmaps(device, cached.texture, format, texture.width, texture.height, cached.mipLevelCount)
      }
      this.stats.textureMemory = Math.max(0, this.stats.textureMemory - cached.bytes)
      cached.version = texture.version
      cached.bytes = texture.estimatedBytes
      this.stats.textureMemory += cached.bytes
      return cached
    }
    if (cached) {
      cached.texture.destroy()
      this.stats.textureMemory = Math.max(0, this.stats.textureMemory - cached.bytes)
    }
    const levels = textureMipLevelCount(texture, this.imageQuality.mipmaps)
    const gpuTexture = device.createTexture({ label: texture.label ?? 'Sekai64 texture', size: [texture.width, texture.height, 1], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT, mipLevelCount: levels })
    uploadTexture(device, gpuTexture, texture)
    if (levels > 1 && !(texture.dataSource?.mipLevels?.length)) generateWebGpuMipmaps(device, gpuTexture, format, texture.width, texture.height, levels)
    this.stats.textureUploads += 1
    this.stats.gpuResourceCreations += 2
    this.stats.gpuResourceCreationsThisFrame += 2
    const minFilter = baseMinFilter(texture.minFilter)
    const magFilter = texture.magFilter
    const mipFilter = mipmapFilter(texture.minFilter)
    const maxAnisotropy = compatibleSamplerAnisotropy(minFilter, magFilter, mipFilter, this.imageQuality.maxAnisotropy)
    const state: WebGPUTextureState = {
      texture: gpuTexture,
      view: gpuTexture.createView(),
      sampler: device.createSampler({
        minFilter,
        magFilter,
        mipmapFilter: mipFilter,
        addressModeU: toAddressMode(texture.wrapS),
        addressModeV: toAddressMode(texture.wrapT),
        maxAnisotropy
      }),
      version: texture.version,
      bytes: texture.estimatedBytes,
      width: texture.width,
      height: texture.height,
      format,
      mipLevelCount: levels,
      lastUsedFrame:this.frameIndex,
    }
    this.textures.set(texture, state)
    this.stats.textureMemory+=state.bytes;this.textureResidency.touch(texture,state.bytes,this.frameIndex,()=>this.evictTexture(texture,state));return state
  }

  private getUniform(mesh: Mesh, material: Material, textureStates: readonly WebGPUTextureState[]): WebGPUObjectUniform {
    let byMaterial = this.uniforms.get(mesh)
    if (!byMaterial) { byMaterial = new Map(); this.uniforms.set(mesh, byMaterial) }
    const cached = byMaterial.get(material)
    if (cached && cached.shadowGeneration === this.shadowGeneration && sameTextureStates(cached.textureStates, textureStates)) { this.stats.bindGroupCacheHits += 1; return cached }
    this.stats.bindGroupCacheMisses += 1
    const device = this.device as GPUDevice
    const layout = this.bindGroupLayout as GPUBindGroupLayout
    if (cached) cached.buffer.destroy()
    const buffer = device.createBuffer({ label: `Sekai64 uniforms: ${mesh.id}`, size: 1760, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const entries: object[] = [{ binding: 0, resource: { buffer } }]
    textureStates.slice(0,7).forEach((state, index) => {
      entries.push({ binding: 1 + index * 2, resource: state.sampler })
      entries.push({ binding: 2 + index * 2, resource: state.view })
    })
    entries.push({ binding: 15, resource: this.shadowSampler as GPUSampler })
    entries.push({binding:16,resource:this.shadowTextureView as GPUTextureView})
    entries.push({binding:17,resource:(textureStates[7] as WebGPUTextureState).sampler},{binding:18,resource:(textureStates[7] as WebGPUTextureState).view},{binding:19,resource:(textureStates[8] as WebGPUTextureState).sampler},{binding:20,resource:(textureStates[8] as WebGPUTextureState).view},{binding:21,resource:(textureStates[9] as WebGPUTextureState).sampler},{binding:22,resource:(textureStates[9] as WebGPUTextureState).view},{binding:23,resource:(textureStates[10] as WebGPUTextureState).sampler},{binding:24,resource:(textureStates[10] as WebGPUTextureState).view},{binding:25,resource:(textureStates[11] as WebGPUTextureState).sampler},{binding:26,resource:(textureStates[11] as WebGPUTextureState).view},{binding:27,resource:(textureStates[12] as WebGPUTextureState).sampler},{binding:28,resource:(textureStates[12] as WebGPUTextureState).view},{binding:29,resource:(textureStates[13] as WebGPUTextureState).sampler},{binding:30,resource:(textureStates[13] as WebGPUTextureState).view},{binding:31,resource:(textureStates[14] as WebGPUTextureState).sampler},{binding:32,resource:(textureStates[14] as WebGPUTextureState).view})
    const bindGroup = device.createBindGroup({ label: `Sekai64 bind group: ${mesh.id}`, layout, entries })
    const uniform = { buffer, bindGroup, values: new Float32Array(440), textureStates: [...textureStates], shadowGeneration: this.shadowGeneration }
    byMaterial.set(material, uniform)
    this.stats.bindGroupChanges += 1
    this.stats.gpuResourceCreations += 2
    this.stats.gpuResourceCreationsThisFrame += 2
    return uniform
  }

  private getShadowUniform(mesh: Mesh, material: Material, cascadeIndex: number, textureState: WebGPUTextureState): WebGPUShadowUniform {
    let materials = this.shadowUniforms.get(mesh)
    if (!materials) { materials = new Map(); this.shadowUniforms.set(mesh, materials) }
    let cascades = materials.get(material)
    if (!cascades) { cascades = []; materials.set(material, cascades) }
    const cached = cascades[cascadeIndex]
    if (cached?.textureState === textureState) return cached
    cached?.buffer.destroy()
    const device = this.device as GPUDevice
    const buffer = device.createBuffer({ label: `Sekai64 shadow uniforms: ${mesh.id} cascade ${cascadeIndex}`, size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const bindGroup = device.createBindGroup({ label: `Sekai64 shadow bind group: ${mesh.id} cascade ${cascadeIndex}`, layout: this.shadowBindGroupLayout as GPUBindGroupLayout, entries: [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: textureState.sampler },
      { binding: 2, resource: textureState.view },
    ] })
    const uniform = { buffer, bindGroup, values: new Float32Array(48), textureState }
    cascades[cascadeIndex] = uniform
    this.stats.bindGroupChanges += 1;this.stats.gpuResourceCreations += 2;this.stats.gpuResourceCreationsThisFrame += 2
    return uniform
  }

  private getShaderUniform(mesh: Mesh, material: ShaderMaterial): WebGPUShaderUniform {
    let byMaterial = this.shaderUniforms.get(mesh)
    if (!byMaterial) { byMaterial = new Map(); this.shaderUniforms.set(mesh, byMaterial) }
    const cached = byMaterial.get(material)
    if (cached) return cached
    const device = this.device as GPUDevice
    const buffer = device.createBuffer({
      label: `Sekai64 ShaderMaterial uniforms: ${mesh.id}`,
      size: 416,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      label: `Sekai64 ShaderMaterial bind group: ${mesh.id}`,
      layout: this.shaderBindGroupLayout as GPUBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    })
    const uniform = { buffer, bindGroup, values: new Float32Array(104) }
    byMaterial.set(material, uniform)
    this.stats.bindGroupChanges += 1;this.stats.gpuResourceCreations += 2;this.stats.gpuResourceCreationsThisFrame += 2
    return uniform
  }

  private getShadowPipeline(instanced: boolean, masked: boolean, doubleSided: boolean): GPURenderPipeline {
    const key = `${instanced ? 1 : 0}:${masked ? 1 : 0}:${doubleSided ? 1 : 0}`
    const cached = this.shadowPipelines.get(key)
    if (cached) { this.stats.pipelineCacheHits += 1; return cached }
    const device = this.device as GPUDevice
    const module = device.createShaderModule({ label: `Sekai64 shadow shader${instanced ? ' instanced' : ''}${masked ? ' masked' : ''}`, code: createShadowShaderSource(instanced, masked) })
    const buffers: object[] = [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }]
    if (masked) {
      buffers.push({ arrayStride: 8, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] })
      buffers.push({ arrayStride: 8, attributes: [{ shaderLocation: 7, offset: 0, format: 'float32x2' }] })
      buffers.push({ arrayStride: 16, attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x4' }] })
    }
    if (instanced) {
      buffers.push({ arrayStride: 64, stepMode: 'instance', attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x4' }, { shaderLocation: 4, offset: 16, format: 'float32x4' }, { shaderLocation: 5, offset: 32, format: 'float32x4' }, { shaderLocation: 6, offset: 48, format: 'float32x4' }] })
      if (masked) buffers.push({ arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 10, offset: 0, format: 'float32x4' }] })
    }
    this.stats.shaderCompilations += 1;this.stats.gpuResourceCreations += 2
    const pipeline = device.createRenderPipeline({
      label: `Sekai64 directional shadow pipeline ${key}`,
      layout: this.shadowPipelineLayout as GPUPipelineLayout,
      vertex: { module, entryPoint: 'vertex_main', buffers },
      ...(masked ? { fragment: { module, entryPoint: 'fragment_main', targets: [] } } : {}),
      primitive: { topology: 'triangle-list', cullMode: doubleSided ? 'none' : 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' },
    })
    this.shadowPipelines.set(key, pipeline)
    this.stats.pipelineCacheMisses += 1
    return pipeline
  }

  private ensureShadowResources(): void {
    const device = this.device
    if (!device) return
    const size=this.shadowOptions.mapSize;const layers=Math.max(1,Math.min(4,this.shadowOptions.cascades))
    if(this.shadowTexture&&this.shadowTextureView&&this.shadowSampler&&this.shadowMapSize===size&&this.shadowCascadeLayers===layers)return
    this.releaseShadowResources()
    this.shadowTexture = device.createTexture({ label: 'Sekai64 directional shadow map', size: [size,size,layers], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })
    this.shadowTextureView=this.shadowTexture.createView({dimension:'2d-array',baseArrayLayer:0,arrayLayerCount:layers})
    this.shadowLayerViews.length=0
    for(let layer=0;layer<layers;layer+=1)this.shadowLayerViews.push(this.shadowTexture.createView({dimension:'2d',baseArrayLayer:layer,arrayLayerCount:1}))
    this.shadowSampler = device.createSampler({ compare: 'less-equal', minFilter: 'linear', magFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' })
    this.shadowMapSize=size
    this.shadowCascadeLayers=layers
    this.shadowGeneration += 1
    this.stats.textureMemory+=size*size*layers*4
    this.stats.gpuResourceCreations+=3+layers;this.stats.gpuResourceCreationsThisFrame+=3+layers
  }

  private releaseShadowResources(): void {
    if (this.shadowMapSize > 0) this.stats.textureMemory = Math.max(0, this.stats.textureMemory - this.shadowMapSize*this.shadowMapSize*Math.max(1,this.shadowCascadeLayers)*4)
    this.shadowTexture?.destroy()
    this.shadowTexture = undefined
    this.shadowTextureView = undefined
    this.shadowLayerViews.length=0
    this.shadowSampler = undefined
    this.shadowMapSize=0
    this.shadowCascadeLayers=0
    this.shadowAvailable = false
    this.shadowGeneration += 1
    for (const uniforms of this.uniforms.values()) for (const uniform of uniforms.values()) uniform.buffer.destroy()
    this.uniforms.clear()
  }

  private getOutlinePipeline(instanced: boolean): GPURenderPipeline {
    const key=`${instanced?1:0}:${this.sampleCount}`
    const cached=this.outlinePipelines.get(key);if(cached){this.stats.pipelineCacheHits+=1;return cached}
    const device=this.device as GPUDevice
    const module=device.createShaderModule({label:`Sekai64 MToon outline shader${instanced?' instanced':''}`,code:createShaderSource(instanced)})
    const buffers:object[]=[
      {arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'float32x3'}]},
      {arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:'float32x3'}]},
      {arrayStride:8,attributes:[{shaderLocation:2,offset:0,format:'float32x2'}]},
      {arrayStride:8,attributes:[{shaderLocation:7,offset:0,format:'float32x2'}]},
      {arrayStride:16,attributes:[{shaderLocation:8,offset:0,format:'float32x4'}]},
      {arrayStride:16,attributes:[{shaderLocation:9,offset:0,format:'float32x4'}]},
    ]
    if(instanced)buffers.push({arrayStride:64,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'float32x4'},{shaderLocation:4,offset:16,format:'float32x4'},{shaderLocation:5,offset:32,format:'float32x4'},{shaderLocation:6,offset:48,format:'float32x4'}]})
    const pipeline=device.createRenderPipeline({label:`Sekai64 MToon outline pipeline ${key}`,layout:this.pipelineLayout as GPUPipelineLayout,vertex:{module,entryPoint:'outline_vertex',buffers},fragment:{module,entryPoint:'outline_fragment',targets:[{format:this.format}]},primitive:{topology:'triangle-list',cullMode:'front',frontFace:'ccw'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'},multisample:{count:this.sampleCount}})
    this.outlinePipelines.set(key,pipeline);this.stats.pipelineCacheMisses+=1;this.stats.shaderCompilations+=1;this.stats.gpuResourceCreations+=2;this.stats.gpuResourceCreationsThisFrame+=2;return pipeline
  }

  private uploadEnvironmentMap(environment: RendererEnvironmentMap): WebGPUTextureState {
    const specular=this.uploadEnvironmentTexture(environment,environment.mipLevels,environment.format??'rgba8-srgb',environment.label??'Sekai64 environment specular',true)
    this.environmentDiffuseTexture=environment.diffuse?this.uploadEnvironmentTexture(environment.diffuse,undefined,environment.format??'rgba8-srgb',`${environment.label??'Sekai64 environment'} diffuse`,false):undefined
    this.environmentBrdfTexture=environment.brdfLut?this.uploadEnvironmentTexture(environment.brdfLut,undefined,'rgba16f-linear',`${environment.label??'Sekai64 environment'} BRDF LUT`,false,true):undefined
    return specular
  }

  private uploadEnvironmentTexture(level:{width:number;height:number;pixels:RendererEnvironmentMap['pixels']},mipLevels:RendererEnvironmentMap['mipLevels'],encoding:'rgba8-srgb'|'rgba16f-linear',label:string,generateMissingMipmaps:boolean,clampU=false):WebGPUTextureState{
    const device=this.device as GPUDevice
    const hdr=encoding==='rgba16f-linear'
    const format:GPUTextureFormat=hdr?'rgba16float':'rgba8unorm-srgb'
    const levels=mipLevels?.length?1+mipLevels.length:(generateMissingMipmaps?mipLevelCount(level.width,level.height,true):1)
    const texture=device.createTexture({label,size:[level.width,level.height,1],format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|(levels>1?GPUTextureUsage.RENDER_ATTACHMENT:0),mipLevelCount:levels})
    const write=(mip:number,width:number,height:number,pixels:RendererEnvironmentMap['pixels']):void=>{
      if(hdr&&!(pixels instanceof Float32Array))throw new Error(`${label} expects Float32Array pixels for rgba16f-linear.`)
      if(!hdr&&pixels instanceof Float32Array)throw new Error(`${label} expects 8-bit pixels for rgba8-srgb.`)
      const data=hdr?float32ToFloat16(pixels as Float32Array):pixels as Uint8Array|Uint8ClampedArray
      device.queue.writeTexture({texture,mipLevel:mip},data,{bytesPerRow:width*(hdr?8:4),rowsPerImage:height},[width,height,1])
    }
    write(0,level.width,level.height,level.pixels)
    if(mipLevels?.length){for(let index=0;index<mipLevels.length;index+=1){const mip=mipLevels[index];if(mip)write(index+1,mip.width,mip.height,mip.pixels)}}
    else if(levels>1)generateWebGpuMipmaps(device,texture,format,level.width,level.height,levels)
    const bytesPerPixel=hdr?8:4
    const bytes=level.width*level.height*bytesPerPixel+(mipLevels?.reduce((sum,mip)=>sum+mip.width*mip.height*bytesPerPixel,0)??(levels>1?Math.ceil(level.width*level.height*bytesPerPixel/3):0))
    this.stats.textureMemory+=bytes;this.stats.textureUploads+=1
    return {texture,view:texture.createView(),sampler:device.createSampler({minFilter:'linear',magFilter:'linear',mipmapFilter:'linear',addressModeU:clampU?'clamp-to-edge':'repeat',addressModeV:'clamp-to-edge',maxAnisotropy:Math.max(1,Math.min(16,this.imageQuality.maxAnisotropy))}),version:0,bytes,width:level.width,height:level.height,format,mipLevelCount:levels,lastUsedFrame:this.frameIndex}
  }

  private releaseEnvironmentTexture(): void {
    for(const state of [this.environmentTexture,this.environmentDiffuseTexture,this.environmentBrdfTexture]){if(!state)continue;state.texture.destroy();this.stats.textureMemory=Math.max(0,this.stats.textureMemory-state.bytes)}
    this.environmentTexture=undefined;this.environmentDiffuseTexture=undefined;this.environmentBrdfTexture=undefined
    this.environmentBackgroundBindGroup=undefined;this.environmentBackgroundBoundTexture=undefined;this.environmentBackgroundBoundCloudTexture=undefined
    for(const uniforms of this.uniforms.values())for(const uniform of uniforms.values())uniform.buffer.destroy();this.uniforms.clear()
  }

  private evictTexture(texture: Texture, state: WebGPUTextureState): void {
    if(this.textures.get(texture)!==state)return
    state.texture.destroy();this.textures.delete(texture);this.stats.textureMemory=Math.max(0,this.stats.textureMemory-state.bytes)
    for(const [mesh,uniforms] of this.uniforms){for(const [material,uniform] of uniforms){if(uniform.textureStates.includes(state)){uniform.buffer.destroy();uniforms.delete(material)}}if(uniforms.size===0)this.uniforms.delete(mesh)}
  }

  private getShaderPipeline(mesh: Mesh, material: ShaderMaterial): GPURenderPipeline | null {
    if (mesh instanceof InstancedMesh) {
      this.reportOnce(`SHADER_INSTANCING:${material.label ?? mesh.id}`, {
        severity: 'warning',
        code: 'SEKAI64_SHADER_MATERIAL_INSTANCING_UNSUPPORTED',
        message: 'ShaderMaterial is not rendered on InstancedMesh yet. Use a regular Mesh or a standard material.',
        details: { backend: this.backend, meshId: mesh.id, material: material.label },
      })
      return null
    }
    const source = material.wgsl
    if (!source) {
      this.reportOnce(`SHADER_SOURCE:${material.label ?? mesh.id}`, {
        severity: 'warning',
        code: 'SEKAI64_SHADER_MATERIAL_WGSL_REQUIRED',
        message: 'ShaderMaterial requires WGSL source for the WebGPU backend.',
        details: { backend: this.backend, meshId: mesh.id, material: material.label },
      })
      return null
    }
    let materialPipelines = this.shaderPipelines.get(material)
    if (!materialPipelines) {
      materialPipelines = new Map()
      this.shaderPipelines.set(material, materialPipelines)
    }
    const key = `${material.transparent ? 1 : 0}:${material.side}:${material.depthWrite ? 1 : 0}:${this.sampleCount}`
    const cached = materialPipelines.get(key)
    if (cached) { this.stats.pipelineCacheHits += 1; return cached }
    const device = this.device as GPUDevice
    const module = device.createShaderModule({ label: material.label ?? 'Sekai64 ShaderMaterial', code: `${source.vertex}\n${source.fragment}` })
    const buffers: object[] = [
      { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
      { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      { arrayStride: 8, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
      { arrayStride: 8, attributes: [{ shaderLocation: 7, offset: 0, format: 'float32x2' }] },
      { arrayStride: 16, attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x4' }] },
      { arrayStride: 16, attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }] },
    ]
    const pipeline = device.createRenderPipeline({
      label: `${material.label ?? 'Sekai64 ShaderMaterial'} pipeline`,
      layout: this.shaderPipelineLayout as GPUPipelineLayout,
      vertex: { module, entryPoint: 'vertex_main', buffers },
      fragment: {
        module,
        entryPoint: 'fragment_main',
        targets: [{
          format: this.format,
          ...(material.transparent ? { blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } } : {}),
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: material.side === 'double' ? 'none' : material.side === 'back' ? 'front' : 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: material.depthWrite, depthCompare: 'less-equal' },
      multisample: { count: this.sampleCount },
    })
    materialPipelines.set(key, pipeline)
    this.stats.pipelineCacheMisses += 1;this.stats.shaderCompilations += 1;this.stats.gpuResourceCreations += 2;this.stats.gpuResourceCreationsThisFrame += 2
    return pipeline
  }

  private getPipeline(transparent: boolean, side: 'front' | 'back' | 'double', depthWrite: boolean, instanced: boolean, alphaCoverage = false): GPURenderPipeline {
    const key = `${transparent ? 1 : 0}:${side}:${depthWrite ? 1 : 0}:${this.sampleCount}:${instanced ? 1 : 0}:${alphaCoverage ? 1 : 0}`
    const cached = this.pipelines.get(key)
    if (cached) { this.stats.pipelineCacheHits += 1; return cached }
    const device = this.device as GPUDevice
    const module = device.createShaderModule({ label: 'Sekai64 standard shader', code: createShaderSource(instanced) })
    const buffers: object[] = [
      { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
      { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      { arrayStride: 8, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
      { arrayStride: 8, attributes: [{ shaderLocation: 7, offset: 0, format: 'float32x2' }] },
      { arrayStride: 16, attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x4' }] },
      { arrayStride: 16, attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }] }
    ]
    if (instanced) { buffers.push({ arrayStride: 64, stepMode: 'instance', attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x4' }, { shaderLocation: 4, offset: 16, format: 'float32x4' }, { shaderLocation: 5, offset: 32, format: 'float32x4' }, { shaderLocation: 6, offset: 48, format: 'float32x4' }] }); buffers.push({ arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 10, offset: 0, format: 'float32x4' }] }) }
    const pipeline = device.createRenderPipeline({ label: `Sekai64 pipeline ${key}`, layout: this.pipelineLayout as GPUPipelineLayout, vertex: { module, entryPoint: 'vertex_main', buffers }, fragment: { module, entryPoint: 'fragment_main', targets: [{ format: this.format, ...(transparent ? { blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } } : {}) }] }, primitive: { topology: 'triangle-list', cullMode: side === 'double' ? 'none' : side === 'back' ? 'front' : 'back', frontFace: 'ccw' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare: 'less-equal' }, multisample: { count: this.sampleCount, alphaToCoverageEnabled: alphaCoverage } })
    this.pipelines.set(key, pipeline)
    this.stats.pipelineCacheMisses += 1;this.stats.shaderCompilations += 1;this.stats.gpuResourceCreations += 2;this.stats.gpuResourceCreationsThisFrame += 2
    return pipeline
  }

  private reportLightLimits(lights: ReturnType<typeof collectSceneLights>): void {
    if (lights.pointCount > lights.selectedPointCount) this.reportOnce('POINT_LIGHT_LIMIT', {
      severity: 'warning', code: 'SEKAI64_POINT_LIGHT_LIMIT', message: `Sekai64 selected ${lights.selectedPointCount} of ${lights.pointCount} visible point lights for this frame.`, details: { backend: this.backend, visible: lights.pointCount, selected: lights.selectedPointCount, maximum: this.maxPointLights }
    })
    if (lights.spotCount > lights.selectedSpotCount) this.reportOnce('SPOT_LIGHT_LIMIT', {
      severity: 'warning', code: 'SEKAI64_SPOT_LIGHT_LIMIT', message: `Sekai64 selected ${lights.selectedSpotCount} of ${lights.spotCount} visible spot lights for this frame.`, details: { backend: this.backend, visible: lights.spotCount, selected: lights.selectedSpotCount, maximum: this.maxSpotLights }
    })
  }

  private reportUnsupportedMaterial(mesh: Mesh, material: Material): void {
    if (material.wireframe) this.reportOnce(`WIREFRAME:${material.label ?? mesh.id}`, {
      severity: 'warning', code: 'SEKAI64_WIREFRAME_UNSUPPORTED', message: 'Wireframe rendering is not supported; the material is rendered filled.', details: { backend: this.backend, meshId: mesh.id, material: material.label }
    })
  }

  private reportOnce(key: string, diagnostic: Parameters<NonNullable<RendererDiagnosticSink>>[0]): void {
    if (this.reportedDiagnostics.has(key)) return
    this.reportedDiagnostics.add(key)
    this.diagnostics?.(diagnostic)
  }

  private collectDisposedResources(): void {
    for (const [geometry, gpu] of this.geometries) if (geometry.disposed) {
      gpu.positionBuffer.destroy(); gpu.normalBuffer.destroy(); gpu.uvBuffer.destroy(); gpu.uv1Buffer.destroy(); gpu.colorBuffer.destroy(); gpu.tangentBuffer.destroy(); gpu.indexBuffer?.destroy()
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - gpu.bytes)
      this.geometries.delete(geometry)
      this.geometryResidency.remove(geometry)
    }
    for (const [mesh, uniforms] of this.uniforms) {
      for (const [material, uniform] of uniforms) if (mesh.disposed || material.disposed) { uniform.buffer.destroy(); uniforms.delete(material) }
      if (mesh.disposed || uniforms.size === 0) this.uniforms.delete(mesh)
    }
    for (const [mesh, uniforms] of this.shaderUniforms) {
      for (const [material, uniform] of uniforms) if (mesh.disposed || material.disposed) { uniform.buffer.destroy(); uniforms.delete(material) }
      if (mesh.disposed || uniforms.size === 0) this.shaderUniforms.delete(mesh)
    }
    for (const [mesh, materials] of this.shadowUniforms) {
      for (const [material, cascades] of materials) if (mesh.disposed || material.disposed) { for (const uniform of cascades) uniform?.buffer.destroy(); materials.delete(material) }
      if (mesh.disposed || materials.size === 0) this.shadowUniforms.delete(mesh)
    }
    for (const [mesh, state] of this.instances) if (mesh.disposed) {
      state.matrixBuffer.destroy()
      state.colorBuffer.destroy()
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - state.bytes)
      this.instances.delete(mesh)
    }
    for (const [field, state] of this.pointFields) if (field.disposed) {
      state.positionBuffer.destroy(); state.colorBuffer.destroy(); state.appearanceBuffer.destroy(); state.uniformBuffer.destroy()
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - state.bytes)
      this.pointFields.delete(field)
    }
    for (const [texture, state] of this.textures) if (texture.disposed) {
      state.texture.destroy()
      this.stats.textureMemory = Math.max(0, this.stats.textureMemory - state.bytes)
      this.textures.delete(texture)
      this.textureResidency.remove(texture)
    }
    for (const [material] of this.shaderPipelines) if (material.disposed) this.shaderPipelines.delete(material)
  }

  private assertReady(): void {
    if (this.disposed) throw new Error('WebGPURenderer is disposed.')
    if (!this.device || !this.context || !this.whiteTexture) throw new Error('WebGPURenderer is not initialized.')
  }
}

function emptyBinding(texture?: Texture, texCoord: 0 | 1 = 0): TextureBinding { return { texture, texCoord } }
function writeShaderUniformValues(
  target: Float32Array,
  mesh: Mesh,
  camera: Camera,
  cameraPosition: Vector3,
  width: number,
  height: number,
  pixelRatio: number,
  values: Iterable<UniformValue>,
): void {
  target.fill(0)
  target.set(mesh.worldMatrix.elements, 0)
  target.set(camera.viewProjectionMatrix.elements, 16)
  target.set([cameraPosition.x, cameraPosition.y, cameraPosition.z, 0], 32)
  target.set([width, height, pixelRatio, 0], 36)
  let slot = 0
  for (const value of values) {
    if (slot >= 16) break
    const offset = 40 + slot * 4
    if (typeof value === 'number') target[offset] = Number.isFinite(value) ? value : 0
    else {
      const length = Math.min(4, value.length)
      for (let index = 0; index < length; index += 1) {
        const item = Number(value[index] ?? 0)
        target[offset + index] = Number.isFinite(item) ? item : 0
      }
    }
    slot += 1
  }
}
function materialSurface(material: Material): MaterialSurface | null {
  if (material instanceof StandardMaterial) {
    const mtoon = material.shadingModel === 'mtoon'
    const outlineMode = material.mtoonOutlineWidthMode === 'screenCoordinates' ? 2 : material.mtoonOutlineWidthMode === 'worldCoordinates' ? 1 : 0
    const outlineMix = material.mtoonOutlineLightingMix
    const outlineColor = mtoon
      ? [
          material.mtoonOutlineColor.r * ((1 - outlineMix) + material.baseColor.r * outlineMix),
          material.mtoonOutlineColor.g * ((1 - outlineMix) + material.baseColor.g * outlineMix),
          material.mtoonOutlineColor.b * ((1 - outlineMix) + material.baseColor.b * outlineMix),
        ] as const
      : [material.toonOutlineColor.r, material.toonOutlineColor.g, material.toonOutlineColor.b] as const
    const mtoonMaskMode = material.mtoonShadingShiftTexture ? 1 : material.faceShadowTexture ? 2 : 0
    return {
    color: material.baseColor,
    emissive: [material.emissive.r * material.emissiveIntensity, material.emissive.g * material.emissiveIntensity, material.emissive.b * material.emissiveIntensity],
    mode: material.shadingModel === 'toon' ? 4 : mtoon ? 5 : material.shadingModel === 'water' ? 6 : 1,
    alphaCutoff: material.alphaMode === 'mask' ? material.alphaCutoff : 0,
    metallicFactor: material.metallic,
    roughnessFactor: material.roughness,
    normalScale: material.normalScale,
    occlusionStrength: material.occlusionStrength,
    textureScale: material.textureScale,
    textureOffset: material.textureOffset,
    textureRotation: material.textureRotation,
    forceOpaqueAlpha: material.alphaMode !== 'blend',
    baseColor: emptyBinding(material.baseColorTexture, material.baseColorTexCoord),
    metallicRoughness: emptyBinding(material.metallicRoughnessTexture, material.metallicRoughnessTexCoord),
    metallic: mtoon ? emptyBinding(material.mtoonShadeTexture, material.mtoonShadeTexCoord) : emptyBinding(material.metallicTexture, material.metallicTexCoord),
    roughness: mtoon ? emptyBinding(material.mtoonMatcapTexture, material.mtoonMatcapTexCoord) : emptyBinding(material.roughnessTexture, material.roughnessTexCoord),
    normal: emptyBinding(material.normalTexture, material.normalTexCoord),
    emissiveTexture: emptyBinding(material.emissiveTexture, material.emissiveTexCoord),
    occlusion: emptyBinding(material.occlusionTexture, material.occlusionTexCoord),
    detailNormal: emptyBinding(material.detailNormalTexture),
    detailRoughness: emptyBinding(material.detailRoughnessTexture),
    detailHeight: emptyBinding(material.detailHeightTexture),
    detailScale: material.detailScale,
    detailNormalStrength: material.detailNormalTexture ? material.detailNormalStrength : 0,
    detailRoughnessStrength: material.detailRoughnessTexture ? material.detailRoughnessStrength : 0,
    detailHeightScale: material.detailHeightTexture ? material.detailHeightScale : 0,
    transmission: material.transmission,
    ior: material.ior,
    thickness: material.thickness,
    attenuationColor: [material.attenuationColor.r, material.attenuationColor.g, material.attenuationColor.b],
    attenuationDistance: material.attenuationDistance,
    toonParams: mtoon
      ? [material.characterHairSpecularPower, material.mtoonShadingToony, 0, material.mtoonRimLightingMix]
      : [material.toonShadeSteps, material.toonShadowStrength, material.toonHighlightStrength, material.toonRimStrength],
    toonParams2: mtoon
      ? [material.mtoonRimFresnelPower, material.mtoonOutlineWidth, outlineMode, material.mtoonShadingShift]
      : [material.toonRimPower, material.toonOutlineStrength, material.toonOutlinePower, 0],
    toonShadowColor: mtoon
      ? [material.mtoonShadeColor.r, material.mtoonShadeColor.g, material.mtoonShadeColor.b]
      : [material.toonShadowColor.r, material.toonShadowColor.g, material.toonShadowColor.b],
    toonHighlightColor: mtoon
      ? [material.mtoonMatcapColor.r, material.mtoonMatcapColor.g, material.mtoonMatcapColor.b]
      : [material.toonHighlightColor.r, material.toonHighlightColor.g, material.toonHighlightColor.b],
    toonRimColor: mtoon
      ? [material.mtoonRimColor.r, material.mtoonRimColor.g, material.mtoonRimColor.b]
      : [material.toonRimColor.r, material.toonRimColor.g, material.toonRimColor.b],
    toonOutlineColor: outlineColor,
    faceShadow: mtoon && material.mtoonShadingShiftTexture ? emptyBinding(material.mtoonShadingShiftTexture, material.mtoonShadingShiftTexCoord) : emptyBinding(material.faceShadowTexture, material.faceShadowTexCoord),
    faceShadowStrength: material.mtoonFaceShadowStrength,
    faceShadowFlipX: material.mtoonFaceShadowFlipX,
    hairAlphaDither: mtoon && material.mtoonHairAlphaDither,
    outlineWidth: material.mtoonOutlineWidth,
    lightMap: mtoon && material.mtoonRimTexture ? emptyBinding(material.mtoonRimTexture, material.mtoonRimTexCoord) : emptyBinding(material.lightMapTexture, material.lightMapTexCoord),
    lightMapIntensity: material.lightMapIntensity,
    specularFactor: material.specularFactor,
    specularColor: [material.specularColor.r,material.specularColor.g,material.specularColor.b],
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
    sheenColor: [material.sheenColor.r,material.sheenColor.g,material.sheenColor.b],
    sheenIntensity: material.sheenIntensity,
    sheenRoughness: material.sheenRoughness,
    alphaDither: material.alphaDither,
    toonParams3: mtoon ? [material.mtoonOcclusionMix,material.characterSoftLighting,material.characterEyeHighlightStrength,material.characterHairSpecularStrength] : [material.toonBandSmoothness,material.toonShadowOffset,material.toonEnvironmentMix,0],
    mtoonAdvanced2: mtoon ? [material.mtoonGiEqualization,material.mtoonRimLift,material.mtoonShadingShiftTextureScale,mtoonMaskMode] : [material.mtoonEnvironmentMix,material.mtoonFaceShadowSoftness,0,0],
    waterParams: [material.waterFresnelPower,material.waterReflectionStrength,material.waterAbsorptionStrength,material.lightMapIntensity],
    waterMotion: [material.waterWaveScale,material.waterWaveStrength,material.waterWaveSpeed,material.waterFoamStrength],
    waterFlow: material.waterFlowDirection,
    waterShallowColor: [material.waterShallowColor.r,material.waterShallowColor.g,material.waterShallowColor.b],
    waterDeepColor: [material.waterDeepColor.r,material.waterDeepColor.g,material.waterDeepColor.b],
    waterFoamColor: [material.waterFoamColor.r,material.waterFoamColor.g,material.waterFoamColor.b],
  }
  }
  const base = { detailNormal:emptyBinding(),detailRoughness:emptyBinding(),detailHeight:emptyBinding(),detailScale:1,detailNormalStrength:0,detailRoughnessStrength:0,detailHeightScale:0,textureScale:[1,1] as const,textureOffset:[0,0] as const,textureRotation:0,toonParams: [3,0.58,0.2,0.18] as const, toonParams2: [2.5,0.68,5,0] as const, toonParams3:[0.08,0,0.18,0] as const,mtoonAdvanced2:[0.12,0.08,0,0] as const, toonShadowColor: [0.4,0.44,0.56] as const, toonHighlightColor: [1,0.96,0.87] as const, toonRimColor: [1,0.84,0.91] as const, toonOutlineColor: [0.125,0.102,0.165] as const, emissive: [0, 0, 0] as const, metallicFactor: 0, roughnessFactor: 1, normalScale: 1, occlusionStrength: 1, metallicRoughness: emptyBinding(), metallic: emptyBinding(), roughness: emptyBinding(), normal: emptyBinding(), emissiveTexture: emptyBinding(), occlusion: emptyBinding(), transmission: 0, ior: 1.5, thickness: 0, attenuationColor: [1, 1, 1] as const, attenuationDistance: 1, faceShadow: emptyBinding(), faceShadowStrength: 0, faceShadowFlipX: false, hairAlphaDither: false, outlineWidth: 0,lightMap:emptyBinding(),lightMapIntensity:1,specularFactor:1,specularColor:[1,1,1] as const,clearcoat:0,clearcoatRoughness:0.1,sheenColor:[1,1,1] as const,sheenIntensity:0,sheenRoughness:0.5,alphaDither:false,waterParams:[5,0.78,1,1] as const,waterMotion:[0.45,0,0.35,0.18] as const,waterFlow:[0.9438583563660174,0.33035042472810605] as const,waterShallowColor:[0.333,0.722,0.839] as const,waterDeepColor:[0.039,0.247,0.404] as const,waterFoamColor:[0.91,0.984,1] as const }
  if (material instanceof TextureMaterial) return { ...base, color: material.tint, mode: 0, alphaCutoff: material.alphaCutoff, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding(material.map) }
  if (material instanceof BasicMaterial) return { ...base, color: material.baseColor, mode: 0, alphaCutoff: 0, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding() }
  if (material instanceof NormalMaterial) return { ...base, color: new Color(), mode: 2, alphaCutoff: 0, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding() }
  if (material instanceof DepthMaterial) return { ...base, color: new Color(), mode: 3, alphaCutoff: 0, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding() }
  return null
}
function createBuffer(device: GPUDevice, source: Float32Array | Uint16Array | Uint32Array, usage: GPUBufferUsageFlags, label: string): GPUBuffer {
  const buffer = device.createBuffer({ label, size: Math.max(4, Math.ceil(source.byteLength / 4) * 4), usage, mappedAtCreation: true })
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength))
  buffer.unmap()
  return buffer
}
function createDefaultColors(vertexCount: number): Float32Array {
  const colors = new Float32Array(vertexCount * 4)
  colors.fill(1)
  return colors
}
function sameTextureStates(left: readonly WebGPUTextureState[], right: readonly WebGPUTextureState[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
function baseMinFilter(value: Texture['minFilter']): 'nearest' | 'linear' { return value.startsWith('nearest') ? 'nearest' : 'linear' }
function mipmapFilter(value: Texture['minFilter']): 'nearest' | 'linear' { return value.endsWith('nearest') ? 'nearest' : 'linear' }
function compatibleSamplerAnisotropy(
  minFilter: 'nearest' | 'linear',
  magFilter: 'nearest' | 'linear',
  mipFilter: 'nearest' | 'linear',
  requested: number,
): number {
  // WebGPU requires every sampler filter to be linear when anisotropy is enabled.
  // Preserve the texture's authored filtering (especially VRM/glTF nearest mip modes)
  // and disable anisotropy for incompatible combinations instead of mutating them.
  if (minFilter !== 'linear' || magFilter !== 'linear' || mipFilter !== 'linear') return 1
  return Math.max(1, Math.min(16, requested))
}
function createWhiteTexture(device: GPUDevice): WebGPUTextureState {
  const texture = device.createTexture({ label: 'Sekai64 fallback texture', size: [1, 1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST })
  device.queue.writeTexture({ texture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4, rowsPerImage: 1 }, [1, 1, 1])
  return { texture, view: texture.createView(), sampler: device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' }), version: 0, bytes: 4, width: 1, height: 1, format: 'rgba8unorm', mipLevelCount: 1, lastUsedFrame:0 }
}


function float32ToFloat16(source:Float32Array):Uint16Array{
  const output=new Uint16Array(source.length)
  const floatView=new Float32Array(1),intView=new Uint32Array(floatView.buffer)
  for(let index=0;index<source.length;index+=1){floatView[0]=source[index]??0;const bits=intView[0]??0;const sign=(bits>>>16)&0x8000;const exponent=((bits>>>23)&0xff)-127+15;const mantissa=bits&0x7fffff;if(exponent<=0){if(exponent<-10){output[index]=sign;continue}const shifted=(mantissa|0x800000)>>(1-exponent);output[index]=sign|((shifted+0x1000)>>13);continue}if(exponent>=31){output[index]=sign|0x7c00|(mantissa?0x0200:0);continue}output[index]=sign|(exponent<<10)|((mantissa+0x1000)>>13)}
  return output
}
function mipLevelCount(width: number, height: number, enabled: boolean): number {
  return enabled ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1
}

interface MipmapPipelineState { layout: GPUBindGroupLayout; pipeline: GPURenderPipeline; sampler: GPUSampler }
const mipmapPipelines = new WeakMap<GPUDevice, Map<string, MipmapPipelineState>>()

function getMipmapPipeline(device: GPUDevice, format: GPUTextureFormat): MipmapPipelineState {
  let formats = mipmapPipelines.get(device)
  if (!formats) { formats = new Map(); mipmapPipelines.set(device, formats) }
  const existing = formats.get(format)
  if (existing) return existing
  const layout = device.createBindGroupLayout({ label: 'Sekai64 mipmap resources', entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
  ] })
  const module = device.createShaderModule({ label: 'Sekai64 mipmap shader', code: `
    struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
    @vertex fn vertex_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var positions = array<vec2<f32>, 3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
      var output: VertexOutput; output.position=vec4<f32>(positions[index],0.0,1.0); output.uv=positions[index]*vec2<f32>(0.5,-0.5)+vec2<f32>(0.5); return output;
    }
    @group(0) @binding(0) var sourceSampler: sampler;
    @group(0) @binding(1) var sourceTexture: texture_2d<f32>;
    @fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> { return textureSampleLevel(sourceTexture,sourceSampler,input.uv,0.0); }
  ` })
  const pipeline = device.createRenderPipeline({ label: `Sekai64 mipmap pipeline ${format}`, layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), vertex: { module, entryPoint: 'vertex_main' }, fragment: { module, entryPoint: 'fragment_main', targets: [{ format }] }, primitive: { topology: 'triangle-list' } })
  const state = { layout, pipeline, sampler: device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) }
  formats.set(format, state)
  return state
}

function generateWebGpuMipmaps(device: GPUDevice, texture: GPUTexture, format: GPUTextureFormat, width: number, height: number, levels: number): void {
  const state = getMipmapPipeline(device, format)
  const encoder = device.createCommandEncoder({ label: 'Sekai64 mipmap encoder' })
  for (let level = 1; level < levels; level += 1) {
    const sourceView = texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1, lastUsedFrame:0 })
    const targetView = texture.createView({ baseMipLevel: level, mipLevelCount: 1, lastUsedFrame:0 })
    const bindGroup = device.createBindGroup({ layout: state.layout, entries: [{ binding: 0, resource: state.sampler }, { binding: 1, resource: sourceView }] })
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: targetView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] })
    pass.setPipeline(state.pipeline); pass.setBindGroup(0, bindGroup); pass.draw(3); pass.end()
    width = Math.max(1, width >> 1); height = Math.max(1, height >> 1)
  }
  device.queue.submit([encoder.finish()])
}

function uploadTexture(device: GPUDevice, target: GPUTexture, texture: Texture): void {
  const data = texture.dataSource
  if (data) {
    const levels = [{ width: data.width, height: data.height, data: data.data }, ...(data.mipLevels ?? []).filter(level => level.width !== data.width || level.height !== data.height)]
    for (let mipLevel = 0; mipLevel < levels.length; mipLevel += 1) {
      const level = levels[mipLevel] as { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
      device.queue.writeTexture({ texture: target, mipLevel }, level.data, { bytesPerRow: level.width * 4, rowsPerImage: level.height }, [level.width, level.height, 1])
    }
    return
  }
  const image = texture.image
  if (!image) return
  if (typeof ImageData !== 'undefined' && image instanceof ImageData) {
    device.queue.writeTexture({ texture: target }, image.data, { bytesPerRow: image.width * 4, rowsPerImage: image.height }, [image.width, image.height, 1])
    return
  }
  device.queue.copyExternalImageToTexture({ source: image, flipY: texture.flipY }, { texture: target }, [texture.width, texture.height])
}

function textureMipLevelCount(texture: Texture, allowGeneratedMipmaps: boolean): number {
  const explicit = texture.dataSource?.mipLevels?.filter(level => level.width !== texture.width || level.height !== texture.height).length ?? 0
  if (explicit > 0) return explicit + 1
  return mipLevelCount(texture.width, texture.height, texture.generateMipmaps && allowGeneratedMipmaps)
}
function toAddressMode(value: 'clamp-to-edge' | 'repeat' | 'mirror-repeat'): string {
  return value === 'mirror-repeat' ? 'mirror-repeat' : value
}
function linearColor(value: readonly [number, number, number]): [number, number, number] {
  return [srgbToLinear(value[0]), srgbToLinear(value[1]), srgbToLinear(value[2])]
}

function resetStats(stats: RendererStats): void {
  stats.drawCalls = 0
  stats.instancedDrawCalls = 0
  stats.instancesRendered = 0
  stats.triangles = 0
  stats.visibleObjects = 0
  stats.culledObjects = 0
  stats.frustumCulledObjects = 0
  stats.occlusionCulledObjects = 0
  stats.occlusionCandidates = 0
  stats.pipelineChanges = 0
  stats.pipelineCacheHits = 0
  stats.pipelineCacheMisses = 0
  stats.geometryCacheHits = 0
  stats.geometryCacheMisses = 0
  stats.textureCacheHits = 0
  stats.textureCacheMisses = 0
  stats.bindGroupCacheHits = 0
  stats.bindGroupCacheMisses = 0
  stats.shaderCompilations = 0
  stats.materialChanges = 0
  stats.uniformUpdates = 0
  stats.bindGroupChanges = 0
  stats.geometryUploads = 0
  stats.geometryEvictions = 0
  stats.textureUploads = 0
  stats.textureEvictions = 0
  stats.shadowDrawCalls = 0
  stats.shadowedLights = 0
  stats.postProcessPasses = 0
  stats.renderQueueBuildMs = 0
  stats.renderQueueSortMs = 0
  stats.lightGridBuildMs = 0
  stats.shadowPassMs = 0
  stats.mainPassMs = 0
  stats.postProcessMs = 0
  stats.residencyMs = 0
  stats.transformNodesVisited = 0
  stats.transformNodesUpdated = 0
  stats.transformSubtreesSkipped = 0
  stats.boundsCacheHits = 0
  stats.boundsCacheMisses = 0
  stats.renderItemAllocations = 0
  stats.renderItemPoolSize = 0
  stats.clusterCount = 0
  stats.clusteredLightReferences = 0
  stats.clusterOverflows = 0
  stats.maxClusterLights = 0
  stats.visibleLights = 0
  stats.rejectedLights = 0
  stats.staticBatches = 0
  stats.lodSwitches = 0
  stats.lodLevelCounts = []
  stats.gpuResourceCreationsThisFrame = 0
}

function copyPointLights(source: readonly ClusteredPointLight[], target: ClusteredPointLight[], maximum: number): readonly ClusteredPointLight[] {
  target.length = 0
  for (let index = 0; index < Math.min(maximum, source.length); index += 1) {
    const light = source[index]
    if (light) target.push(light)
  }
  return target
}

function now():number{return typeof performance!=='undefined'?performance.now():Date.now()}
function updateFrameStats(stats:RendererStats,start:number,previous:number):void{const end=now();stats.cpuFrameMs=end-start;const interval=previous>0?start-previous:stats.cpuFrameMs;stats.fps=interval>0?1000/interval:0;stats.renderScale=stats.renderScale||1}
