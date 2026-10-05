import type { Camera } from '@sekai64-internal/cameras'
import type { Geometry } from '@sekai64-internal/geometry'
import { collectSceneLights, type SceneLightSummary } from '@sekai64-internal/lighting'
import { BasicMaterial, DepthMaterial, NormalMaterial, ShaderMaterial, StandardMaterial, Texture, TextureMaterial, type Material, type UniformValue } from '@sekai64-internal/materials'
import { Box3, Color, Frustum, Matrix4, Vector3, type ColorInput } from '@sekai64-internal/math'
import { ClusteredLightGrid, GeometryResidencyManager, RenderQueueBuilder, createDirectionalShadowCascades, createProceduralCloudNoise, createRendererAdvancedCapabilities, createRendererFeatures, createRendererStats, HierarchicalDepthCuller, resolveAtmosphere, resolveColorGrading, resolveColorManagement, resolveEnvironmentLighting, resolveImageQuality, resolveOptimization, resolvePostProcessing, resolveProceduralCloudState, resolveShadowOptions, srgbToLinear, TextureResidencyManager, type RecoverableRenderer, type RendererAtmosphere, type RendererCapabilities, type RendererColorGrading, type RendererColorManagement, type RendererDiagnosticSink, type RendererEnvironmentLighting, type RendererEnvironmentMap, type RendererImageQuality, type RendererOptimizationOptions, type RendererOptions, type RendererPostProcessing, type RendererProceduralCloudInput, type RendererProceduralCloudState, type RendererRecoveryOptions, type RendererShadowOptions, type RendererStats, type RenderSurface, type RenderItem, type ClusteredPointLight } from '@sekai64-internal/renderer'
import { InstancedMesh, PointField, type Mesh, type Scene } from '@sekai64-internal/scene'
import { WebGLPostProcessPipeline } from './WebGLPostProcessPipeline.js'

interface WebGLGeometry {
  vao: WebGLVertexArrayObject
  positionBuffer: WebGLBuffer
  normalBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
  uv1Buffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  tangentBuffer: WebGLBuffer
  indexBuffer?: WebGLBuffer
  count: number
  indexed: boolean
  indexType: number
  bytes: number
  version: number
}
interface WebGLInstances { matrixBuffer: WebGLBuffer; colorBuffer: WebGLBuffer; matrixVersion: number; colorVersion: number; bytes: number }
interface WebGLTextureState {
  texture: WebGLTexture
  version: number
  bytes: number
  width: number
  height: number
  colorSpace: Texture['colorSpace']
  lastUsedFrame: number
}
interface Uniforms {
  model: WebGLUniformLocation | null
  viewProjection: WebGLUniformLocation | null
  cameraPosition: WebGLUniformLocation | null
  baseColor: WebGLUniformLocation | null
  emissive: WebGLUniformLocation | null
  ambient: WebGLUniformLocation | null
  directionalColor: WebGLUniformLocation | null
  directionalDirection: WebGLUniformLocation | null
  pointPositions: WebGLUniformLocation | null
  pointColors: WebGLUniformLocation | null
  pointCount: WebGLUniformLocation | null
  spotPositions: WebGLUniformLocation | null
  spotDirections: WebGLUniformLocation | null
  spotColors: WebGLUniformLocation | null
  spotCount: WebGLUniformLocation | null
  mode: WebGLUniformLocation | null
  alphaCutoff: WebGLUniformLocation | null
  alphaCoverage: WebGLUniformLocation | null
  metallic: WebGLUniformLocation | null
  roughness: WebGLUniformLocation | null
  normalScale: WebGLUniformLocation | null
  occlusionStrength: WebGLUniformLocation | null
  textureTransform: WebGLUniformLocation | null
  textureRotation: WebGLUniformLocation | null
  forceOpaqueAlpha: WebGLUniformLocation | null
  baseColorMap: WebGLUniformLocation | null
  metallicRoughnessMap: WebGLUniformLocation | null
  normalMap: WebGLUniformLocation | null
  emissiveMap: WebGLUniformLocation | null
  occlusionMap: WebGLUniformLocation | null
  useBaseColorMap: WebGLUniformLocation | null
  useMetallicRoughnessMap: WebGLUniformLocation | null
  useNormalMap: WebGLUniformLocation | null
  useEmissiveMap: WebGLUniformLocation | null
  useOcclusionMap: WebGLUniformLocation | null
  baseColorTexCoord: WebGLUniformLocation | null
  metallicRoughnessTexCoord: WebGLUniformLocation | null
  normalTexCoord: WebGLUniformLocation | null
  emissiveTexCoord: WebGLUniformLocation | null
  occlusionTexCoord: WebGLUniformLocation | null
  metallicMap: WebGLUniformLocation | null
  roughnessMap: WebGLUniformLocation | null
  useMetallicMap: WebGLUniformLocation | null
  useRoughnessMap: WebGLUniformLocation | null
  metallicTexCoord: WebGLUniformLocation | null
  roughnessTexCoord: WebGLUniformLocation | null
  detailNormalMap: WebGLUniformLocation | null
  detailRoughnessMap: WebGLUniformLocation | null
  detailHeightMap: WebGLUniformLocation | null
  useDetailNormalMap: WebGLUniformLocation | null
  useDetailRoughnessMap: WebGLUniformLocation | null
  useDetailHeightMap: WebGLUniformLocation | null
  detailParams: WebGLUniformLocation | null
  surfaceDetailParams: WebGLUniformLocation | null
  outputParams: WebGLUniformLocation | null
  environmentSky: WebGLUniformLocation | null
  environmentGround: WebGLUniformLocation | null
  environmentParams: WebGLUniformLocation | null
  glassParams: WebGLUniformLocation | null
  attenuationColor: WebGLUniformLocation | null
  shadowMatrix: WebGLUniformLocation | null
  shadowMatrices: WebGLUniformLocation | null
  shadowSplits: WebGLUniformLocation | null
  shadowCascadeParams: WebGLUniformLocation | null
  shadowMap: WebGLUniformLocation | null
  shadowParams: WebGLUniformLocation | null
  shadowQuality: WebGLUniformLocation | null
  receiveShadow: WebGLUniformLocation | null
  toonParams: WebGLUniformLocation | null
  toonParams2: WebGLUniformLocation | null
  toonShadowColor: WebGLUniformLocation | null
  toonHighlightColor: WebGLUniformLocation | null
  toonRimColor: WebGLUniformLocation | null
  toonOutlineColor: WebGLUniformLocation | null
  atmosphereColor: WebGLUniformLocation | null
  atmosphereParams: WebGLUniformLocation | null
  atmosphereParams2: WebGLUniformLocation | null
  gradingParams: WebGLUniformLocation | null
  gradingParams2: WebGLUniformLocation | null
  gradingParams3: WebGLUniformLocation | null
  viewportSize: WebGLUniformLocation | null
  faceShadowMap: WebGLUniformLocation | null
  useFaceShadowMap: WebGLUniformLocation | null
  faceShadowTexCoord: WebGLUniformLocation | null
  mtoonAdvanced: WebGLUniformLocation | null
  environmentMap: WebGLUniformLocation | null
  environmentDiffuseMap: WebGLUniformLocation | null
  environmentBrdfLut: WebGLUniformLocation | null
  environmentMapParams: WebGLUniformLocation | null
  environmentIblParams: WebGLUniformLocation | null
  lightMap: WebGLUniformLocation | null
  useLightMap: WebGLUniformLocation | null
  lightMapTexCoord: WebGLUniformLocation | null
  pbrAdvanced: WebGLUniformLocation | null
  specularColor: WebGLUniformLocation | null
  sheenColor: WebGLUniformLocation | null
  waterParams: WebGLUniformLocation | null
  waterMotion: WebGLUniformLocation | null
  waterFlowTime: WebGLUniformLocation | null
  waterShallowColor: WebGLUniformLocation | null
  waterDeepColor: WebGLUniformLocation | null
  waterFoamColor: WebGLUniformLocation | null
  toonParams3: WebGLUniformLocation | null
  mtoonAdvanced2: WebGLUniformLocation | null
}
interface ProgramState { program: WebGLProgram; uniforms: Uniforms }
interface DepthUniforms {
  model: WebGLUniformLocation | null
  lightViewProjection: WebGLUniformLocation | null
  baseColor: WebGLUniformLocation | null
  alphaCutoff: WebGLUniformLocation | null
  baseColorMap: WebGLUniformLocation | null
  useBaseColorMap: WebGLUniformLocation | null
  baseColorTexCoord: WebGLUniformLocation | null
  textureTransform: WebGLUniformLocation | null
  textureRotation: WebGLUniformLocation | null
}
interface DepthProgramState { program: WebGLProgram; uniforms: DepthUniforms }
interface OutlineUniforms { model: WebGLUniformLocation | null; viewProjection: WebGLUniformLocation | null; width: WebGLUniformLocation | null; mode: WebGLUniformLocation | null; color: WebGLUniformLocation | null }
interface OutlineProgramState { program: WebGLProgram; uniforms: OutlineUniforms }
interface ShaderUniforms {
  model: WebGLUniformLocation | null
  viewProjection: WebGLUniformLocation | null
  cameraPosition: WebGLUniformLocation | null
  viewport: WebGLUniformLocation | null
  custom: WebGLUniformLocation | null
}
interface ShaderProgramState { program: WebGLProgram; uniforms: ShaderUniforms }
interface EnvironmentBackgroundProgramState { program: WebGLProgram; inverseViewProjection: WebGLUniformLocation | null; cameraPosition: WebGLUniformLocation | null; environmentMap: WebGLUniformLocation | null; cloudNoiseMap: WebGLUniformLocation | null; params: WebGLUniformLocation | null; outputParams: WebGLUniformLocation | null; cloudParams: WebGLUniformLocation | null; cloudMotion: WebGLUniformLocation | null; cloudSun: WebGLUniformLocation | null; cloudShape: WebGLUniformLocation | null; cloudHorizon: WebGLUniformLocation | null; cloudLighting: WebGLUniformLocation | null; cloudDetailMotion: WebGLUniformLocation | null; cloudAmbientColor: WebGLUniformLocation | null; cloudShadowColor: WebGLUniformLocation | null; cloudLightColor: WebGLUniformLocation | null }
interface PointFieldProgramState {
  program: WebGLProgram
  model: WebGLUniformLocation | null
  viewProjection: WebGLUniformLocation | null
  viewport: WebGLUniformLocation | null
  directional: WebGLUniformLocation | null
  outputParams: WebGLUniformLocation | null
}
interface WebGLPointFieldState {
  vao: WebGLVertexArrayObject
  positionBuffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  appearanceBuffer: WebGLBuffer
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
  metallic: number
  roughness: number
  normalScale: number
  occlusionStrength: number
  textureScale: readonly [number, number]
  textureOffset: readonly [number, number]
  textureRotation: number
  forceOpaqueAlpha: boolean
  baseColor: TextureBinding
  metallicRoughness: TextureBinding
  normal: TextureBinding
  emissiveTexture: TextureBinding
  occlusion: TextureBinding
  metallicTexture: TextureBinding
  roughnessTexture: TextureBinding
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
  attenuationDistance: number
  attenuationColor: Color
  toonParams: readonly [number, number, number, number]
  toonParams2: readonly [number, number, number, number]
  toonShadowColor: Color
  toonHighlightColor: Color
  toonRimColor: Color
  toonOutlineColor: Color
  faceShadow: TextureBinding
  faceShadowStrength: number
  faceShadowFlipX: boolean
  hairAlphaDither: boolean
  outlineWidth: number
  lightMap: TextureBinding
  lightMapIntensity: number
  specularFactor: number
  specularColor: Color
  clearcoat: number
  clearcoatRoughness: number
  sheenColor: Color
  sheenIntensity: number
  sheenRoughness: number
  alphaDither: boolean
  toonParams3: readonly [number, number, number, number]
  mtoonAdvanced2: readonly [number, number, number, number]
  waterParams: readonly [number, number, number, number]
  waterMotion: readonly [number, number, number, number]
  waterFlow: readonly [number, number]
  waterShallowColor: Color
  waterDeepColor: Color
  waterFoamColor: Color
}

export interface WebGLViewport { x: number; y: number; width: number; height: number }
export interface WebGLViewportRenderOptions {
  framebuffer?: WebGLFramebuffer | null
  clear?: boolean
  updateScene?: boolean
  updateCamera?: boolean
  resetStats?: boolean
}

const environmentBackgroundVertex = `#version 300 es
precision highp float;
out vec2 v_ndc;
void main(){vec2 p=gl_VertexID==0?vec2(-1.0,-1.0):(gl_VertexID==1?vec2(3.0,-1.0):vec2(-1.0,3.0));v_ndc=p;gl_Position=vec4(p,0.999999,1.0);}`
const environmentBackgroundFragment = `#version 300 es
precision highp float;
#define PI 3.141592653589793
in vec2 v_ndc;
uniform mat4 u_inverseViewProjection;
uniform vec3 u_cameraPosition;
uniform sampler2D u_environmentMap;
uniform sampler2D u_cloudNoiseMap;
uniform vec4 u_params;
uniform vec4 u_outputParams;
uniform vec4 u_cloudParams;
uniform vec4 u_cloudMotion;
uniform vec4 u_cloudSun;
uniform vec4 u_cloudShape;
uniform vec4 u_cloudHorizon;
uniform vec4 u_cloudLighting;
uniform vec4 u_cloudDetailMotion;
uniform vec3 u_cloudAmbientColor;
uniform vec3 u_cloudShadowColor;
uniform vec3 u_cloudLightColor;
out vec4 outColor;
float linearChannelToSrgb(float value){return value<=0.0031308?12.92*value:1.055*pow(max(value,0.0),1.0/2.4)-0.055;}
vec3 linearToSrgb(vec3 value){return vec3(linearChannelToSrgb(value.r),linearChannelToSrgb(value.g),linearChannelToSrgb(value.b));}
vec3 toneMap(vec3 color,float mode){color=max(color,vec3(0.0));if(mode<0.5)return color;if(mode<1.5)return color/(vec3(1.0)+color);if(mode>2.5)return color/(vec3(1.0)+max(color,vec3(0.0))*0.6);return clamp((color*(2.51*color+vec3(0.03)))/(color*(2.43*color+vec3(0.59))+vec3(0.14)),0.0,1.0);}
vec2 environmentUv(vec3 direction){vec3 d=normalize(direction);float phi=atan(d.z,d.x)+u_params.y;return vec2(fract(phi/(2.0*PI)+0.5),acos(clamp(d.y,-1.0,1.0))/PI);}
vec2 cloudDomeCoordinate(vec3 direction,float horizonCompression){
  vec3 d=normalize(direction);
  float vertical=clamp(d.y,0.0,1.0);
  float perspective=0.72+0.38/max(0.22,vertical+0.18);
  float horizonExtension=max(u_cloudLighting.z,0.0001);
  float underlapDistance=clamp(-d.y/horizonExtension,0.0,1.0);
  float underlapCompression=mix(1.0,0.92,underlapDistance*clamp(horizonCompression,0.0,1.0));
  return d.xz*perspective*underlapCompression;
}
float smoothNoise(vec2 uv,int channel){vec4 n=texture(u_cloudNoiseMap,fract(uv));return channel==0?n.r:(channel==1?n.g:(channel==2?n.b:n.a));}
float classicFbm(vec2 p,int channel,float inverseCells){
  float value=0.0;float amplitude=0.5;float frequency=1.0;float total=0.0;
  for(int octave=0;octave<5;octave++){
    vec2 shift=vec2(float(octave)*0.173,-float(octave)*0.119);
    value+=smoothNoise(p*frequency*inverseCells+shift,channel)*amplitude;
    total+=amplitude;amplitude*=0.5;frequency*=2.03;
  }
  return value/max(total,0.0001);
}
float cloudMacroField(vec2 base,float evolution){
  float macroScale=max(u_cloudShape.x,0.2);
  float warp=(smoothNoise(base*0.041+vec2(evolution*0.019,-evolution*0.013),3)-0.5)*u_cloudShape.w;
  vec2 w=vec2(warp,-warp*0.73);
  float large=classicFbm((base+vec2(evolution*0.018,evolution*0.011))*(0.36*macroScale)+w,0,0.25);
  float medium=classicFbm((base+vec2(-evolution*0.027,evolution*0.021))*(0.92*macroScale)+vec2(7.3,-4.1)+w*1.15,1,0.125);
  return clamp(large*0.59+medium*0.41,0.0,1.0);
}
float cloudDetailField(vec2 base,float evolution){
  float detailScale=max(u_cloudShape.y,0.2);
  return classicFbm((base+vec2(evolution*0.081,-evolution*0.063))*(2.35*detailScale)+vec2(-11.7,6.8),2,0.0625);
}
vec4 proceduralCloud(vec3 direction){
  float horizonExtension=max(u_cloudLighting.z,0.0);
  if(u_cloudParams.x<0.5||u_cloudParams.y<=0.0||direction.y<=-horizonExtension)return vec4(0.0);
  float vertical=clamp(direction.y,0.0,1.0);
  float underlapDistance=horizonExtension>0.0001?clamp(-direction.y/horizonExtension,0.0,1.0):0.0;
  float underlapFade=direction.y>=0.0?1.0:smoothstep(-horizonExtension,0.0,direction.y);
  vec2 domain=cloudDomeCoordinate(direction,u_cloudLighting.w)*u_cloudParams.w;
  vec2 macroBase=domain+u_cloudMotion.xy;
  vec2 detailBase=domain+u_cloudDetailMotion.xy;
  float macro=cloudMacroField(macroBase,u_cloudMotion.z);
  float small=cloudDetailField(detailBase,u_cloudDetailMotion.z);
  float detailGain=clamp(u_cloudShape.z/0.1,0.0,5.0);
  float erosion=abs(small*2.0-1.0);
  float field=clamp(macro*0.88+small*(0.18*detailGain)-erosion*(0.06*detailGain),0.0,1.0);
  float threshold=mix(0.79,0.37,u_cloudParams.y);
  float softness=max(u_cloudHorizon.x,0.01);
  float body=smoothstep(threshold-softness*0.5,threshold+softness*1.333333,field);
  float classicHorizon=smoothstep(0.015,max(0.14,u_cloudHorizon.z),vertical);
  float horizonPresence=mix(u_cloudHorizon.y,1.0,classicHorizon);
  float underlapAtmosphere=clamp(u_cloudDetailMotion.w,0.0,1.0);
  float underlapDensity=mix(1.0,0.72,underlapDistance*underlapAtmosphere);
  float amount=clamp(body*min(u_cloudParams.z,1.5)*horizonPresence*underlapFade*underlapDensity,0.0,1.0);
  if(amount<=0.0001)return vec4(0.0);
  float eps=0.055/max(u_cloudShape.x,0.2);
  float gx=cloudMacroField(macroBase+vec2(eps,0.0),u_cloudMotion.z)-cloudMacroField(macroBase-vec2(eps,0.0),u_cloudMotion.z);
  float gz=cloudMacroField(macroBase+vec2(0.0,eps),u_cloudMotion.z)-cloudMacroField(macroBase-vec2(0.0,eps),u_cloudMotion.z);
  vec3 pseudoNormal=normalize(vec3(-gx*4.6,1.0,-gz*4.6));
  vec3 sunDirection=normalize(u_cloudSun.xyz);
  float diffuse=clamp(dot(pseudoNormal,sunDirection),0.0,1.0);
  float sunFacing=clamp(dot(direction,sunDirection),0.0,1.0);
  float interior=smoothstep(threshold+0.035,threshold+0.2,field);
  float sunStrength=clamp(u_cloudSun.w/8.0,0.0,1.0);
  float lightMix=clamp(0.1+diffuse*u_cloudLighting.y*sunStrength,0.0,1.0);
  vec3 lit=mix(u_cloudShadowColor,u_cloudLightColor,lightMix);
  vec3 cloudColor=mix(u_cloudAmbientColor,lit,0.82);
  float silverLining=(1.0-interior)*pow(sunFacing,5.0)*u_cloudHorizon.w*sunStrength;
  float baseShade=1.0-interior*(u_cloudLighting.x+(1.0-vertical)*u_cloudLighting.x*0.85);
  cloudColor=cloudColor*baseShade+vec3(silverLining,silverLining*0.92,silverLining*0.72);
  float distanceHaze=clamp(underlapDistance*underlapAtmosphere*0.5,0.0,0.92);
  cloudColor=mix(cloudColor,u_cloudAmbientColor,distanceHaze);
  return vec4(cloudColor,amount);
}
void main(){
  vec4 world=u_inverseViewProjection*vec4(v_ndc,1.0,1.0);
  vec3 direction=normalize(world.xyz/max(abs(world.w),0.000001)-u_cameraPosition);
  vec3 color=textureLod(u_environmentMap,environmentUv(direction),0.0).rgb*max(u_params.x,0.0);
  vec4 cloud=proceduralCloud(direction);
  color=mix(color,cloud.rgb,cloud.a);
  if(u_params.z>0.5)color=toneMap(color*u_outputParams.x,u_outputParams.y);
  if(u_outputParams.z>0.5)color=linearToSrgb(color);
  outColor=vec4(clamp(color,0.0,1.0),1.0);
}`

const vertexHeader = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=7) in vec2 a_uv1;
layout(location=8) in vec4 a_color;
layout(location=9) in vec4 a_tangent;
uniform mat4 u_model;
uniform mat4 u_viewProjection;
out vec3 v_normal;
out vec3 v_worldPosition;
out vec2 v_uv;
out vec2 v_uv1;
out vec4 v_color;
out vec4 v_tangent;`
const regularVertex = `${vertexHeader}
void main(){mat3 model3=mat3(u_model);mat3 normalMatrix=transpose(inverse(model3));float handedness=determinant(model3)<0.0?-1.0:1.0;vec4 worldPosition=u_model*vec4(a_position,1.0);gl_Position=u_viewProjection*worldPosition;v_worldPosition=worldPosition.xyz;v_normal=normalMatrix*a_normal;v_uv=a_uv;v_uv1=a_uv1;v_color=a_color;v_tangent=vec4(model3*a_tangent.xyz,a_tangent.w*handedness);}`
const instancedVertex = `${vertexHeader}
layout(location=3) in vec4 a_instance0;
layout(location=4) in vec4 a_instance1;
layout(location=5) in vec4 a_instance2;
layout(location=6) in vec4 a_instance3;
layout(location=10) in vec4 a_instanceColor;
void main(){mat4 instanceMatrix=mat4(a_instance0,a_instance1,a_instance2,a_instance3);mat4 world=u_model*instanceMatrix;mat3 world3=mat3(world);mat3 normalMatrix=transpose(inverse(world3));float handedness=determinant(world3)<0.0?-1.0:1.0;vec4 worldPosition=world*vec4(a_position,1.0);gl_Position=u_viewProjection*worldPosition;v_worldPosition=worldPosition.xyz;v_normal=normalMatrix*a_normal;v_uv=a_uv;v_uv1=a_uv1;v_color=a_color*a_instanceColor;v_tangent=vec4(world3*a_tangent.xyz,a_tangent.w*handedness);}`
const depthVertex = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=2) in vec2 a_uv;
layout(location=7) in vec2 a_uv1;
layout(location=8) in vec4 a_color;
uniform mat4 u_model;
uniform mat4 u_lightViewProjection;
out vec2 v_uv;
out vec2 v_uv1;
out vec4 v_color;
void main(){gl_Position=u_lightViewProjection*u_model*vec4(a_position,1.0);v_uv=a_uv;v_uv1=a_uv1;v_color=a_color;}`
const instancedDepthVertex = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=2) in vec2 a_uv;
layout(location=7) in vec2 a_uv1;
layout(location=8) in vec4 a_color;
layout(location=3) in vec4 a_instance0;
layout(location=4) in vec4 a_instance1;
layout(location=5) in vec4 a_instance2;
layout(location=6) in vec4 a_instance3;
layout(location=10) in vec4 a_instanceColor;
uniform mat4 u_model;
uniform mat4 u_lightViewProjection;
out vec2 v_uv;
out vec2 v_uv1;
out vec4 v_color;
void main(){mat4 instanceMatrix=mat4(a_instance0,a_instance1,a_instance2,a_instance3);gl_Position=u_lightViewProjection*u_model*instanceMatrix*vec4(a_position,1.0);v_uv=a_uv;v_uv1=a_uv1;v_color=a_color*a_instanceColor;}`
const depthFragment = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_uv1;
in vec4 v_color;
uniform vec4 u_baseColor;
uniform float u_alphaCutoff;
uniform sampler2D u_baseColorMap;
uniform bool u_useBaseColorMap;
uniform int u_baseColorTexCoord;
uniform vec4 u_textureTransform;
uniform float u_textureRotation;
float interleavedGradientNoise(vec2 p){return fract(52.9829189*fract(0.06711056*p.x+0.00583715*p.y));}
vec2 surfaceUv(int texCoord){vec2 uv=texCoord==1?v_uv1:v_uv;vec2 centered=uv-vec2(0.5);float c=cos(u_textureRotation);float ss=sin(u_textureRotation);vec2 rotated=vec2(c*centered.x-ss*centered.y,ss*centered.x+c*centered.y)+vec2(0.5);return rotated*u_textureTransform.xy+u_textureTransform.zw;}
void main(){if(u_alphaCutoff<=0.0)return;float alpha=u_baseColor.a*v_color.a;if(u_useBaseColorMap)alpha*=texture(u_baseColorMap,surfaceUv(u_baseColorTexCoord)).a;float edge=max(fwidth(alpha),1.0/255.0);float coverage=smoothstep(u_alphaCutoff-edge,u_alphaCutoff+edge,alpha);if(coverage<interleavedGradientNoise(gl_FragCoord.xy))discard;}`
const outlineVertex = `#version 300 es
layout(location=0) in vec3 a_position;layout(location=1) in vec3 a_normal;uniform mat4 u_model;uniform mat4 u_viewProjection;uniform float u_outlineWidth;uniform float u_outlineMode;void main(){mat3 normalMatrix=transpose(inverse(mat3(u_model)));vec3 worldNormal=normalize(normalMatrix*a_normal);vec4 worldPosition=u_model*vec4(a_position,1.0);vec4 clip=u_viewProjection*worldPosition;if(u_outlineMode<1.5){worldPosition.xyz+=worldNormal*u_outlineWidth;clip=u_viewProjection*worldPosition;}else{vec4 projectedNormal=u_viewProjection*vec4(worldNormal,0.0);vec2 direction=length(projectedNormal.xy)>0.00001?normalize(projectedNormal.xy):vec2(0.0,1.0);clip.xy+=direction*u_outlineWidth*2.0*clip.w;}gl_Position=clip;}`
const instancedOutlineVertex = `#version 300 es
layout(location=0) in vec3 a_position;layout(location=1) in vec3 a_normal;layout(location=3) in vec4 a_instance0;layout(location=4) in vec4 a_instance1;layout(location=5) in vec4 a_instance2;layout(location=6) in vec4 a_instance3;uniform mat4 u_model;uniform mat4 u_viewProjection;uniform float u_outlineWidth;uniform float u_outlineMode;void main(){mat4 instanceMatrix=mat4(a_instance0,a_instance1,a_instance2,a_instance3);mat4 world=u_model*instanceMatrix;mat3 normalMatrix=transpose(inverse(mat3(world)));vec3 worldNormal=normalize(normalMatrix*a_normal);vec4 worldPosition=world*vec4(a_position,1.0);vec4 clip=u_viewProjection*worldPosition;if(u_outlineMode<1.5){worldPosition.xyz+=worldNormal*u_outlineWidth;clip=u_viewProjection*worldPosition;}else{vec4 projectedNormal=u_viewProjection*vec4(worldNormal,0.0);vec2 direction=length(projectedNormal.xy)>0.00001?normalize(projectedNormal.xy):vec2(0.0,1.0);clip.xy+=direction*u_outlineWidth*2.0*clip.w;}gl_Position=clip;}`
const outlineFragment = `#version 300 es
precision highp float;uniform vec3 u_outlineColor;out vec4 outColor;void main(){outColor=vec4(u_outlineColor,1.0);}`
const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DArray;
#define MAX_POINT_LIGHTS 8
#define MAX_SPOT_LIGHTS 4
#define PI 3.141592653589793
in vec3 v_normal;
in vec3 v_worldPosition;
in vec2 v_uv;
in vec2 v_uv1;
in vec4 v_color;
in vec4 v_tangent;
uniform vec3 u_cameraPosition;
uniform vec4 u_baseColor;
uniform vec3 u_emissive;
uniform vec3 u_ambient;
uniform vec3 u_directionalColor;
uniform vec3 u_directionalDirection;
uniform vec4 u_pointPositions[MAX_POINT_LIGHTS];
uniform vec4 u_pointColors[MAX_POINT_LIGHTS];
uniform int u_pointCount;
uniform vec4 u_spotPositions[MAX_SPOT_LIGHTS];
uniform vec4 u_spotDirections[MAX_SPOT_LIGHTS];
uniform vec4 u_spotColors[MAX_SPOT_LIGHTS];
uniform int u_spotCount;
uniform int u_mode;
uniform float u_alphaCutoff;
uniform bool u_alphaCoverage;
uniform float u_metallic;
uniform float u_roughness;
uniform float u_normalScale;
uniform float u_occlusionStrength;
uniform bool u_forceOpaqueAlpha;
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_emissiveMap;
uniform sampler2D u_occlusionMap;
uniform sampler2D u_metallicMap;
uniform sampler2D u_roughnessMap;
uniform sampler2D u_detailNormalMap;
uniform sampler2D u_detailRoughnessMap;
uniform sampler2D u_detailHeightMap;
uniform bool u_useDetailNormalMap;
uniform bool u_useDetailRoughnessMap;
uniform bool u_useDetailHeightMap;
uniform vec4 u_detailParams;
uniform vec4 u_surfaceDetailParams;
uniform bool u_useBaseColorMap;
uniform bool u_useMetallicRoughnessMap;
uniform bool u_useNormalMap;
uniform bool u_useEmissiveMap;
uniform bool u_useOcclusionMap;
uniform bool u_useMetallicMap;
uniform bool u_useRoughnessMap;
uniform int u_baseColorTexCoord;
uniform int u_metallicRoughnessTexCoord;
uniform int u_normalTexCoord;
uniform int u_emissiveTexCoord;
uniform int u_occlusionTexCoord;
uniform int u_metallicTexCoord;
uniform int u_roughnessTexCoord;
uniform vec4 u_outputParams;
uniform vec3 u_environmentSky;
uniform vec3 u_environmentGround;
uniform vec4 u_environmentParams;
uniform vec4 u_glassParams;
uniform vec3 u_attenuationColor;
uniform mat4 u_shadowMatrix;
uniform mat4 u_shadowMatrices[4];
uniform vec4 u_shadowSplits;
uniform vec4 u_shadowCascadeParams;
uniform sampler2DArray u_shadowMap;
uniform vec4 u_shadowParams;
uniform vec4 u_shadowQuality;
uniform bool u_receiveShadow;
uniform vec4 u_toonParams;
uniform vec4 u_toonParams2;
uniform vec3 u_toonShadowColor;
uniform vec3 u_toonHighlightColor;
uniform vec3 u_toonRimColor;
uniform vec3 u_toonOutlineColor;
uniform vec3 u_atmosphereColor;
uniform vec4 u_atmosphereParams;
uniform vec4 u_atmosphereParams2;
uniform vec4 u_gradingParams;
uniform vec4 u_gradingParams2;
uniform vec4 u_gradingParams3;
uniform vec2 u_viewportSize;
uniform sampler2D u_faceShadowMap;uniform bool u_useFaceShadowMap;uniform int u_faceShadowTexCoord;uniform vec4 u_mtoonAdvanced;
uniform sampler2D u_environmentMap;uniform sampler2D u_environmentDiffuseMap;uniform sampler2D u_environmentBrdfLut;uniform vec4 u_environmentMapParams;uniform vec4 u_environmentIblParams;
uniform sampler2D u_lightMap;uniform bool u_useLightMap;uniform int u_lightMapTexCoord;uniform vec4 u_pbrAdvanced;uniform vec3 u_specularColor;uniform vec4 u_sheenColor;
uniform vec4 u_waterParams;uniform vec4 u_waterMotion;uniform vec4 u_waterFlowTime;uniform vec3 u_waterShallowColor;uniform vec3 u_waterDeepColor;uniform vec3 u_waterFoamColor;uniform vec4 u_toonParams3;uniform vec4 u_mtoonAdvanced2;
uniform vec4 u_textureTransform;uniform float u_textureRotation;
out vec4 outColor;
vec2 uvSet(int index){
  vec2 uv=index==1?v_uv1:v_uv;
  vec2 scaled=uv*u_textureTransform.xy;
  float c=cos(u_textureRotation);float sn=sin(u_textureRotation);
  return vec2(c*scaled.x-sn*scaled.y,sn*scaled.x+c*scaled.y)+u_textureTransform.zw;
}
mat3 surfaceBasis(vec2 basisUv,vec3 n){
  vec3 dp1=dFdx(v_worldPosition);vec3 dp2=dFdy(v_worldPosition);vec2 duv1=dFdx(basisUv);vec2 duv2=dFdy(basisUv);vec3 t;vec3 b;
  if(length(v_tangent.xyz)>0.0001){t=normalize(v_tangent.xyz-n*dot(n,v_tangent.xyz));b=normalize(cross(n,t))*v_tangent.w;}
  else{vec3 dp2perp=cross(dp2,n);vec3 dp1perp=cross(n,dp1);t=dp2perp*duv1.x+dp1perp*duv2.x;b=dp2perp*duv1.y+dp1perp*duv2.y;float basisScale=max(dot(t,t),dot(b,b));if(basisScale>0.0000001){float invmax=inversesqrt(basisScale);t*=invmax;b*=invmax;}else{t=normalize(vec3(n.z,0.0,-n.x));b=cross(n,t);}}
  return mat3(t,b,n);
}
vec2 surfaceUv(int index){
  vec2 uv=uvSet(index);
  if(index!=0||!u_useDetailHeightMap||u_detailParams.w<=0.0||u_surfaceDetailParams.x<0.5||(u_mode!=1&&u_mode!=6))return uv;
  vec3 n=normalize(v_normal);if(!gl_FrontFacing)n=-n;mat3 basis=surfaceBasis(uv,n);vec3 viewTs=transpose(basis)*normalize(u_cameraPosition-v_worldPosition);float vz=max(abs(viewTs.z),0.25);vec2 direction=viewTs.xy/vz;
  float h0=texture(u_detailHeightMap,uv*u_detailParams.x).r-0.5;float h=h0;
  if(u_surfaceDetailParams.x>1.5){vec2 probe=uv-direction*h0*u_detailParams.w;float h1=texture(u_detailHeightMap,probe*u_detailParams.x).r-0.5;h=(h0+h1)*0.5;}
  return uv-direction*h*u_detailParams.w;
}
vec3 srgbToLinear(vec3 value){
  bvec3 cutoff=lessThanEqual(value,vec3(0.04045));
  vec3 low=value/12.92;
  vec3 high=pow((value+0.055)/1.055,vec3(2.4));
  return mix(high,low,cutoff);
}
vec3 linearToSrgb(vec3 value){
  value=clamp(value,0.0,1.0);
  bvec3 cutoff=lessThanEqual(value,vec3(0.0031308));
  vec3 low=value*12.92;
  vec3 high=1.055*pow(value,vec3(1.0/2.4))-0.055;
  return mix(high,low,cutoff);
}
vec3 pbrNeutralToneMap(vec3 color){
  color=max(color,vec3(0.0));
  float x=min(color.r,min(color.g,color.b));
  float offset=x<0.08?x-6.25*x*x:0.04;
  color=max(color-vec3(offset),vec3(0.0));
  float peak=max(color.r,max(color.g,color.b));
  const float startCompression=0.76;
  if(peak<startCompression)return color;
  const float d=1.0-startCompression;
  float newPeak=1.0-d*d/(peak+d-startCompression);
  color*=newPeak/max(peak,0.000001);
  float g=1.0-1.0/(0.15*(peak-newPeak)+1.0);
  return mix(color,vec3(newPeak),g);
}
vec3 toneMap(vec3 color,float mode){
  color=max(color,vec3(0.0));
  if(mode<0.5)return clamp(color,0.0,1.0);
  if(mode<1.5)return color/(vec3(1.0)+color);
  if(mode>2.5)return clamp(pbrNeutralToneMap(color),0.0,1.0);
  const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
  return clamp((color*(a*color+b))/(color*(c*color+d)+e),0.0,1.0);
}
float interleavedGradientNoise(vec2 position){return fract(52.9829189*fract(dot(position,vec2(0.06711056,0.00583715))));}
vec3 outputTransform(vec3 color){
  color=toneMap(color*u_outputParams.x,u_outputParams.y);
  if(u_outputParams.w>0.5)color+=vec3((interleavedGradientNoise(gl_FragCoord.xy)-0.5)/255.0);
  return u_outputParams.z>0.5?linearToSrgb(color):clamp(color,0.0,1.0);
}
vec3 applyAtmosphere(vec3 color,vec3 worldPosition){
  if(u_atmosphereParams2.w<0.5||u_atmosphereParams.x<0.5)return color;
  float distanceToCamera=length(u_cameraPosition-worldPosition);
  float fog=0.0;
  if(u_atmosphereParams.x<1.5){
    fog=smoothstep(u_atmosphereParams.y,u_atmosphereParams.z,distanceToCamera);
  }else{
    float scaled=u_atmosphereParams.w*distanceToCamera;
    fog=1.0-exp(-scaled*scaled);
  }
  if(u_atmosphereParams2.y>0.0){
    float height=max(0.0,worldPosition.y-u_atmosphereParams2.x);
    fog*=exp(-height*u_atmosphereParams2.y);
  }
  fog=clamp(fog,0.0,u_atmosphereParams2.z);
  return mix(color,srgbToLinear(u_atmosphereColor),fog);
}
vec3 applyColorGrading(vec3 color){
  if(u_gradingParams.x<0.5)return max(color,vec3(0.0));
  float luma=dot(color,vec3(0.2126,0.7152,0.0722));
  color=mix(vec3(luma),color,u_gradingParams.y);
  const float pivot=0.18;
  color=(color-pivot)*u_gradingParams.z+pivot+u_gradingParams.w;
  color+=vec3(u_gradingParams2.x*0.055,u_gradingParams2.y*0.03,-u_gradingParams2.x*0.055);
  color+=vec3(-u_gradingParams2.y*0.018,0.0,-u_gradingParams2.y*0.018);
  float highlight=max(dot(color,vec3(0.2126,0.7152,0.0722))-u_gradingParams3.y,0.0);
  color+=color*highlight*u_gradingParams3.x;
  if(u_gradingParams2.z>0.0){
    vec2 uv=gl_FragCoord.xy/max(u_viewportSize,vec2(1.0));
    vec2 centered=uv*2.0-1.0;
    float edge=length(centered*vec2(u_viewportSize.x/max(u_viewportSize.y,1.0),1.0));
    float vignette=smoothstep(max(0.0,1.35-u_gradingParams2.w),1.35,edge)*u_gradingParams2.z;
    color*=1.0-clamp(vignette,0.0,0.92);
  }
  return max(color,vec3(0.0));
}
vec3 finalizeColor(vec3 color,vec3 worldPosition){
  return outputTransform(applyColorGrading(applyAtmosphere(color,worldPosition)));
}
vec2 waterFlowDirection(){
  vec2 direction=u_waterFlowTime.xy;float lengthSquared=dot(direction,direction);return lengthSquared>0.0000001?direction*inversesqrt(lengthSquared):vec2(1.0,0.0);
}
vec2 waterAnimatedUv(vec2 uv,float layer){
  if(u_mode!=6||u_waterMotion.y<=0.0||u_waterMotion.z<=0.0)return uv;
  vec2 flow=waterFlowDirection();vec2 perpendicular=vec2(-flow.y,flow.x);vec2 direction=layer<0.5?flow:normalize(perpendicular-flow*0.28);float sign=layer<0.5?1.0:-1.0;float rate=(layer<0.5?0.022:0.014)*u_waterMotion.z;return uv+direction*(u_waterFlowTime.z*rate*sign);
}
vec3 waterMacroNormal(vec3 n){
  if(u_mode!=6||u_waterMotion.y<=0.0)return n;
  vec2 flow=waterFlowDirection();vec2 perpendicular=vec2(-flow.y,flow.x);vec2 diagonal=normalize(flow*0.72+perpendicular*0.69);vec2 p=v_worldPosition.xz*max(u_waterMotion.x,0.0001);float t=u_waterFlowTime.z*u_waterMotion.z;float a=dot(p,flow)+t;float b=dot(p*1.83,perpendicular)-t*1.31;float c=dot(p*0.54,diagonal)+t*0.63;vec2 slope=flow*cos(a)*0.50+perpendicular*cos(b)*0.31+diagonal*cos(c)*0.19;return normalize(n+vec3(-slope.x,0.0,-slope.y)*u_waterMotion.y);
}
vec3 surfaceNormal(){
  vec3 n=normalize(v_normal);
  if(!gl_FrontFacing)n=-n;
  if(!u_useNormalMap&&!u_useDetailNormalMap)return waterMacroNormal(n);
  vec2 basisUv=u_useNormalMap?waterAnimatedUv(surfaceUv(u_normalTexCoord),0.0):surfaceUv(0);
  vec3 mapNormal=vec3(0.0,0.0,1.0);
  if(u_useNormalMap){
    mapNormal=texture(u_normalMap,basisUv).xyz*2.0-1.0;
    mapNormal.xy*=u_normalScale;
  }
  if(u_useDetailNormalMap){
    vec3 detailNormal=texture(u_detailNormalMap,waterAnimatedUv(surfaceUv(0)*u_detailParams.x,1.0)).xyz*2.0-1.0;
    detailNormal.xy*=u_detailParams.y;
    mapNormal=normalize(vec3(mapNormal.xy+detailNormal.xy,mapNormal.z*max(detailNormal.z,0.0001)));
  }
  return waterMacroNormal(normalize(surfaceBasis(basisUv,n)*mapNormal));
}
float distributionGGX(vec3 n,vec3 h,float roughness){
  float a=roughness*roughness;
  float a2=a*a;
  float ndoth=max(dot(n,h),0.0);
  float denominator=ndoth*ndoth*(a2-1.0)+1.0;
  return a2/max(PI*denominator*denominator,0.000001);
}
float geometrySchlickGGX(float ndotv,float roughness){float r=roughness+1.0;float k=(r*r)/8.0;return ndotv/max(ndotv*(1.0-k)+k,0.000001);}
float geometrySmith(vec3 n,vec3 v,vec3 l,float roughness){return geometrySchlickGGX(max(dot(n,v),0.0),roughness)*geometrySchlickGGX(max(dot(n,l),0.0),roughness);}
vec3 fresnelSchlick(float cosine,vec3 f0){return f0+(1.0-f0)*pow(clamp(1.0-cosine,0.0,1.0),5.0);}
vec3 fresnelSchlickRoughness(float cosine,vec3 f0,float roughness){return f0+(max(vec3(1.0-roughness),f0)-f0)*pow(clamp(1.0-cosine,0.0,1.0),5.0);}
vec3 evaluateLight(vec3 base,vec3 n,vec3 v,vec3 lightDirection,vec3 lightColor,float attenuation,float metallic,float roughness){
  float ndotl=max(dot(n,lightDirection),0.0);
  if(ndotl<=0.0)return vec3(0.0);
  vec3 h=normalize(lightDirection+v);
  float ndotv=max(dot(n,v),0.0001);
  float hdotv=max(dot(h,v),0.0);
  float dielectricIor=max(1.0,u_glassParams.y);float dielectricF0=pow((dielectricIor-1.0)/(dielectricIor+1.0),2.0);vec3 f0=mix(vec3(dielectricF0)*srgbToLinear(u_specularColor)*u_pbrAdvanced.z,base,metallic);
  vec3 f=fresnelSchlick(hdotv,f0);
  float d=distributionGGX(n,h,roughness);
  float g=geometrySmith(n,v,lightDirection,roughness);
  vec3 specular=(d*g*f)/max(4.0*ndotv*ndotl,0.0001);
  vec3 kd=(vec3(1.0)-f)*(1.0-metallic);
  float clearcoatRoughness=clamp(u_pbrAdvanced.y,0.045,1.0);vec3 coatF=fresnelSchlick(hdotv,vec3(0.04));float coatD=distributionGGX(n,h,clearcoatRoughness);float coatG=geometrySmith(n,v,lightDirection,clearcoatRoughness);vec3 coat=(coatD*coatG*coatF)/max(4.0*ndotv*ndotl,0.0001)*u_pbrAdvanced.x;
  float sheenF=pow(1.0-hdotv,5.0)*(1.0-clamp(u_sheenColor.a,0.0,1.0)*0.5);vec3 sheen=srgbToLinear(u_sheenColor.rgb)*u_pbrAdvanced.w*sheenF;
  return (kd*base/PI+specular+coat+sheen)*lightColor*ndotl*attenuation;
}
float luminance(vec3 value){return dot(value,vec3(0.2126,0.7152,0.0722));}
float wrappedLambert(float ndotl,float amount){return clamp((ndotl+amount)/(1.0+amount),0.0,1.0);}
vec2 environmentUv(vec3 direction){vec3 d=normalize(direction);float phi=atan(d.z,d.x)+u_environmentMapParams.z;return vec2(fract(phi/(2.0*PI)+0.5),acos(clamp(d.y,-1.0,1.0))/PI);}
vec3 environmentColor(vec3 n){
  if(u_environmentMapParams.x>0.5){
    if(u_environmentIblParams.x>0.5)return textureLod(u_environmentDiffuseMap,environmentUv(n),0.0).rgb*u_environmentMapParams.y;
    return textureLod(u_environmentMap,environmentUv(n),u_environmentIblParams.z).rgb*u_environmentMapParams.y;
  }
  float hemisphere=clamp(n.y*0.5+0.5,0.0,1.0);vec3 configured=mix(u_environmentGround,u_environmentSky,hemisphere);return configured*u_environmentParams.x;
}
vec3 environmentSpecular(vec3 direction,float roughness){if(u_environmentMapParams.x>0.5){return textureLod(u_environmentMap,environmentUv(direction),roughness*u_environmentIblParams.z).rgb*u_environmentMapParams.y;}return environmentColor(direction);}
vec2 environmentBrdf(float ndotv,float roughness){
  if(u_environmentIblParams.y>0.5)return texture(u_environmentBrdfLut,vec2(clamp(ndotv,0.0,1.0),clamp(roughness,0.0,1.0))).rg;
  vec4 c0=vec4(-1.0,-0.0275,-0.572,0.022);vec4 c1=vec4(1.0,0.0425,1.04,-0.04);vec4 r=roughness*c0+c1;float a004=min(r.x*r.x,exp2(-9.28*ndotv))*r.x+r.y;return vec2(-1.04,1.04)*a004+r.zw;
}
float specularOcclusion(float ndotv,float ao,float roughness){return clamp(pow(ndotv+ao,exp2(-16.0*roughness-1.0))-1.0+ao,0.0,1.0);}
float sampleShadowCascade(int cascade,vec3 n){
  vec4 clip=u_shadowMatrices[cascade]*vec4(v_worldPosition+n*u_shadowParams.y,1.0);
  vec3 projected=clip.xyz/max(clip.w,0.00001);vec2 uv=projected.xy*0.5+0.5;float depth=projected.z*0.5+0.5-u_shadowParams.x;
  if(uv.x<=0.0||uv.x>=1.0||uv.y<=0.0||uv.y>=1.0||depth<=0.0||depth>=1.0)return 1.0;
  vec2 texel=1.0/vec2(textureSize(u_shadowMap,0).xy);float layer=float(cascade);float radius=max(0.0,u_shadowParams.z);int filterMode=int(u_shadowQuality.x+0.5);
  if(filterMode==0||radius<0.25)return depth<=texture(u_shadowMap,vec3(uv,layer)).r?1.0:0.0;
  float visible=0.0;float total=0.0;
  if(filterMode==1){for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float w=float((2-abs(x))*(2-abs(y)));visible+=(depth<=texture(u_shadowMap,vec3(uv+vec2(float(x),float(y))*texel*radius,layer)).r?1.0:0.0)*w;total+=w;}}
  else if(filterMode==2){for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){float w=float((3-abs(x))*(3-abs(y)));visible+=(depth<=texture(u_shadowMap,vec3(uv+vec2(float(x),float(y))*texel*radius,layer)).r?1.0:0.0)*w;total+=w;}}
  else{const vec2 poisson[12]=vec2[12](vec2(-0.61,0.62),vec2(0.17,-0.04),vec2(-0.30,0.79),vec2(0.65,0.49),vec2(-0.82,-0.27),vec2(-0.71,-0.67),vec2(0.98,-0.11),vec2(0.06,0.14),vec2(0.20,0.21),vec2(-0.67,0.33),vec2(-0.10,-0.30),vec2(0.57,0.61));for(int i=0;i<12;i++){visible+=depth<=texture(u_shadowMap,vec3(uv+poisson[i]*texel*radius*1.6,layer)).r?1.0:0.0;}total=12.0;}
  return visible/max(total,1.0);
}
float shadowVisibility(vec3 n,vec3 lightDirection){
  if(!u_receiveShadow||u_shadowParams.w<0.5)return 1.0;
  float viewDepth=max(0.0,-(u_shadowMatrix*vec4(v_worldPosition,1.0)).z);int count=int(u_shadowCascadeParams.x+0.5);int cascade=0;
  if(count>1&&viewDepth>u_shadowSplits.x)cascade=1;if(count>2&&viewDepth>u_shadowSplits.y)cascade=2;if(count>3&&viewDepth>u_shadowSplits.z)cascade=3;
  float primary=sampleShadowCascade(cascade,n);float result=primary;
  if(cascade<count-1){float previous=cascade==0?0.0:(cascade==1?u_shadowSplits.x:(cascade==2?u_shadowSplits.y:u_shadowSplits.z));float split=cascade==0?u_shadowSplits.x:(cascade==1?u_shadowSplits.y:(cascade==2?u_shadowSplits.z:u_shadowSplits.w));float width=max(0.0001,split-previous);float blendStart=split-width*u_shadowQuality.y;float blend=smoothstep(blendStart,split,viewDepth);if(blend>0.0)result=mix(primary,sampleShadowCascade(cascade+1,n),blend);}
  float fadeStart=u_shadowCascadeParams.y*(1.0-u_shadowQuality.z);float fade=1.0-smoothstep(fadeStart,u_shadowCascadeParams.y,viewDepth);return mix(1.0,result,fade);
}
void main(){
  vec4 tint=u_baseColor;
  vec4 sampled=vec4(1.0);
  if(u_useBaseColorMap)sampled=texture(u_baseColorMap,surfaceUv(u_baseColorTexCoord));
  float alpha=tint.a*v_color.a*sampled.a;
  float coverageNoise=interleavedGradientNoise(gl_FragCoord.xy);
  if(u_alphaCutoff>0.0){float edge=max(fwidth(alpha),1.0/255.0);float coverage=smoothstep(u_alphaCutoff-edge,u_alphaCutoff+edge,alpha);if(u_alphaCoverage){alpha=coverage;}else{if(coverage<coverageNoise)discard;alpha=1.0;}}
  else if((u_mtoonAdvanced.w>0.5||u_pbrAdvanced.w<0.0)&&alpha<1.0){if(alpha<coverageNoise)discard;alpha=1.0;}
  float outputAlpha=(u_forceOpaqueAlpha&&!u_alphaCoverage)?1.0:alpha;
  vec3 base=srgbToLinear(tint.rgb)*v_color.rgb*sampled.rgb;
  vec3 color=base;
  if(u_mode==4||u_mode==5){
    vec3 n=surfaceNormal();
    vec3 v=normalize(u_cameraPosition-v_worldPosition);
    float rawAo=1.0;
    if(u_useOcclusionMap){float sampledAo=texture(u_occlusionMap,surfaceUv(u_occlusionTexCoord)).r;rawAo=mix(1.0,sampledAo,u_occlusionStrength);}
    float ao=u_mode==5?mix(1.0,rawAo,clamp(u_toonParams3.x,0.0,1.0)):rawAo;
    float wrap=u_mode==5?clamp(u_toonParams3.y,0.0,1.0):0.0;
    float giEqualization=u_mode==5?clamp(u_mtoonAdvanced2.x,0.0,1.0):0.0;
    vec3 giNormal=normalize(mix(n,vec3(0.0,1.0,0.0),giEqualization));
    vec3 gi=environmentColor(giNormal);
    float lightAmount=clamp(luminance(u_ambient)*0.28+luminance(gi)*0.22,0.0,1.0);
    float primaryShading=-0.15;
    vec3 primaryLightDirection=normalize(vec3(-0.35,0.75,0.55));
    vec3 lightTint=max(u_ambient+gi*0.18,vec3(0.08));
    float directionalLength=length(u_directionalDirection);
    if(directionalLength>0.0001){
      vec3 lightDirection=-u_directionalDirection/directionalLength;
      primaryLightDirection=lightDirection;
      float visibility=shadowVisibility(n,lightDirection);
      float rawDot=dot(n,lightDirection)*visibility;
      float contribution=u_mode==5?wrappedLambert(rawDot,wrap):max(rawDot,0.0);
      primaryShading=max(primaryShading,rawDot);
      lightAmount+=contribution*luminance(u_directionalColor);
      lightTint+=u_directionalColor*contribution;
    }
    for(int i=0;i<MAX_POINT_LIGHTS;i++){
      if(i>=u_pointCount)break;
      vec3 delta=u_pointPositions[i].xyz-v_worldPosition;
      float distanceToLight=length(delta);
      float range=max(u_pointPositions[i].w,0.0001);
      float attenuation=pow(clamp(1.0-distanceToLight/range,0.0,1.0),max(u_pointColors[i].w,0.0001));
      vec3 lightDirection=delta/max(distanceToLight,0.0001);
      float rawDot=dot(n,lightDirection);
      float contribution=(u_mode==5?wrappedLambert(rawDot,wrap):max(rawDot,0.0))*attenuation;
      if(contribution>lightAmount){primaryLightDirection=lightDirection;}
      primaryShading=max(primaryShading,rawDot*attenuation);
      lightAmount+=contribution*luminance(u_pointColors[i].rgb);
      lightTint+=u_pointColors[i].rgb*contribution;
    }
    for(int i=0;i<MAX_SPOT_LIGHTS;i++){
      if(i>=u_spotCount)break;
      vec3 delta=u_spotPositions[i].xyz-v_worldPosition;
      float distanceToLight=length(delta);
      vec3 lightDirection=delta/max(distanceToLight,0.0001);
      float range=max(u_spotPositions[i].w,0.0001);
      float normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);
      float coneDot=dot(normalize(u_spotDirections[i].xyz),-lightDirection);
      float cone=smoothstep(u_spotDirections[i].w,u_spotColors[i].w,coneDot);
      float rawDot=dot(n,lightDirection);
      float contribution=(u_mode==5?wrappedLambert(rawDot,wrap):max(rawDot,0.0))*pow(normalizedDistance,2.0)*cone;
      primaryShading=max(primaryShading,rawDot*cone);
      lightAmount+=contribution*luminance(u_spotColors[i].rgb);
      lightTint+=u_spotColors[i].rgb*contribution;
    }
    float band=0.0;
    vec3 shadowTint=srgbToLinear(u_toonShadowColor);
    vec3 highlightTint=srgbToLinear(u_toonHighlightColor);
    if(u_mode==5){
      float shifted=primaryShading+u_toonParams2.w;
      if(u_useFaceShadowMap){
        float mask=texture(u_faceShadowMap,uvSet(u_faceShadowTexCoord)).r;
        if(u_mtoonAdvanced2.w<1.5)shifted+=mask*u_mtoonAdvanced2.z;
        else{if(u_mtoonAdvanced.y>0.5)mask=texture(u_faceShadowMap,vec2(1.0-uvSet(u_faceShadowTexCoord).x,uvSet(u_faceShadowTexCoord).y)).r;shifted*=mix(1.0,mask,u_mtoonAdvanced.x);}
      }
      float toony=clamp(u_toonParams.y,0.0,1.0);
      float lower=-1.0+toony;
      float upper=1.0-toony;
      band=smoothstep(lower-0.002,upper+0.002,shifted);
      vec3 shadeTerm=shadowTint;
      if(u_useMetallicMap)shadeTerm*=texture(u_metallicMap,surfaceUv(u_metallicTexCoord)).rgb;
      vec3 lightingTint=mix(vec3(1.0),normalize(max(lightTint,vec3(0.0001))),0.12);
      color=mix(shadeTerm,base,band)*lightingTint*ao;
      vec3 worldViewX=normalize(abs(v.y)<0.999?vec3(v.z,0.0,-v.x):vec3(1.0,0.0,0.0));
      vec3 worldViewY=normalize(cross(v,worldViewX));
      vec2 matcapUv=vec2(dot(worldViewX,n),dot(worldViewY,n))*0.495+0.5;
      vec3 rim=vec3(0.0);
      if(u_useRoughnessMap)rim+=srgbToLinear(u_toonHighlightColor)*texture(u_roughnessMap,matcapUv).rgb;
      float parametric=pow(clamp(1.0-dot(n,v)+u_mtoonAdvanced2.y,0.0,1.0),max(u_toonParams2.x,0.0001));
      rim+=srgbToLinear(u_toonRimColor)*parametric;
      if(u_useLightMap)rim*=texture(u_lightMap,uvSet(u_lightMapTexCoord)).rgb;
      vec3 rimLighting=mix(vec3(1.0),clamp(lightTint+gi*0.25,vec3(0.0),vec3(2.0)),clamp(u_toonParams.w,0.0,1.0));
      color+=rim*rimLighting;
      if(u_toonParams3.z>0.0){vec3 h=normalize(primaryLightDirection+v);float eyeSpec=pow(max(dot(n,h),0.0),64.0)*u_toonParams3.z;color+=vec3(eyeSpec)*max(normalize(max(lightTint,vec3(0.0001))),vec3(0.7));}
      if(u_toonParams3.w>0.0){vec3 strand=length(v_tangent.xyz)>0.0001?normalize(v_tangent.xyz):vec3(0.0,1.0,0.0);vec3 h=normalize(primaryLightDirection+v);float sinTH=sqrt(max(0.0,1.0-pow(clamp(dot(strand,h),-1.0,1.0),2.0)));float hairSpec=pow(sinTH,max(2.0,u_toonParams.x))*u_toonParams3.w;color+=vec3(hairSpec)*max(normalize(max(lightTint,vec3(0.0001))),vec3(0.6));}
    }else{
      float steps=max(2.0,u_toonParams.x);
      lightAmount=mix(lightAmount,clamp(lightAmount+luminance(environmentColor(n))*u_toonParams3.z,0.0,1.0),u_toonParams3.z);
      float shifted=clamp(lightAmount+u_toonParams2.w+u_toonParams3.y,0.0,1.0);
      float quantized=floor(shifted*(steps-1.0)+0.5)/(steps-1.0);
      band=mix(quantized,shifted,clamp(u_toonParams3.x,0.0,1.0));
      vec3 shaded=mix(base,base*shadowTint,u_toonParams.y);
      color=mix(shaded,base,band)*mix(vec3(1.0),normalize(max(lightTint,vec3(0.0001))),0.12)*ao;
      float highlight=smoothstep(0.72,0.98,band)*u_toonParams.z;
      color=mix(color,highlightTint,highlight);
      float ndotv=clamp(dot(n,v),0.0,1.0);
      float rim=pow(1.0-ndotv,u_toonParams2.x)*u_toonParams.w;
      color+=srgbToLinear(u_toonRimColor)*rim;
      float outline=pow(1.0-abs(dot(n,v)),u_toonParams2.z)*u_toonParams2.y;
      color=mix(color,srgbToLinear(u_toonOutlineColor),clamp(outline,0.0,1.0));
    }
    vec3 emissive=srgbToLinear(u_emissive);
    if(u_useEmissiveMap)emissive*=texture(u_emissiveMap,surfaceUv(u_emissiveTexCoord)).rgb;
    color=finalizeColor(color+emissive,v_worldPosition);
  }else if(u_mode==1){
    vec3 n=surfaceNormal();
    vec3 v=normalize(u_cameraPosition-v_worldPosition);
    float metallic=clamp(u_metallic,0.0,1.0);
    float roughness=clamp(u_roughness,0.045,1.0);
    if(u_useMetallicRoughnessMap){vec4 mr=texture(u_metallicRoughnessMap,surfaceUv(u_metallicRoughnessTexCoord));roughness*=mr.g;metallic*=mr.b;}
    if(u_useMetallicMap)metallic*=texture(u_metallicMap,surfaceUv(u_metallicTexCoord)).r;
    if(u_useRoughnessMap)roughness*=texture(u_roughnessMap,surfaceUv(u_roughnessTexCoord)).r;
    if(u_useDetailRoughnessMap){float detailRoughness=texture(u_detailRoughnessMap,surfaceUv(0)*u_detailParams.x).r;roughness=mix(roughness,detailRoughness,clamp(u_detailParams.z,0.0,1.0));}
    if(u_surfaceDetailParams.y>0.0){vec3 nx=dFdx(n);vec3 ny=dFdy(n);float variance=max(dot(nx,nx),dot(ny,ny));roughness=sqrt(roughness*roughness+min(variance*u_surfaceDetailParams.y,0.18));}
    metallic=clamp(metallic,0.0,1.0);roughness=clamp(roughness,0.045,1.0);
    float ao=1.0;
    if(u_useOcclusionMap){float sampledAo=texture(u_occlusionMap,surfaceUv(u_occlusionTexCoord)).r;ao=mix(1.0,sampledAo,u_occlusionStrength);}
    vec3 ambient=base*u_ambient*ao;
    vec3 env=environmentColor(n);vec3 specularEnv=environmentSpecular(reflect(-v,n),roughness);
    float ndotv=max(dot(n,v),0.0);
    float dielectricIor=max(1.0,u_glassParams.y);float dielectricF0=pow((dielectricIor-1.0)/(dielectricIor+1.0),2.0);vec3 f0=mix(vec3(dielectricF0)*srgbToLinear(u_specularColor)*u_pbrAdvanced.z,base,metallic);
    vec3 envFresnel=fresnelSchlickRoughness(ndotv,f0,roughness);
    vec3 envKd=(vec3(1.0)-envFresnel)*(1.0-metallic);
    vec3 envDiffuse=envKd*base*env*ao/PI;
    vec2 envBrdf=environmentBrdf(ndotv,roughness);
    vec3 envSpecular=specularEnv*(f0*envBrdf.x+envBrdf.y)*u_environmentParams.y*specularOcclusion(ndotv,ao,roughness);
    float coatFresnel=pow(1.0-ndotv,5.0);vec2 coatBrdf=environmentBrdf(ndotv,u_pbrAdvanced.y);envSpecular+=environmentSpecular(reflect(-v,n),u_pbrAdvanced.y)*(vec3(0.04)*coatBrdf.x+coatBrdf.y)*mix(0.04,1.0,coatFresnel)*u_pbrAdvanced.x*u_environmentParams.y;
    envSpecular+=srgbToLinear(u_sheenColor.rgb)*u_pbrAdvanced.w*pow(1.0-ndotv,5.0)*(1.0-u_sheenColor.a*0.5);
    vec3 lightMapContribution=vec3(0.0);if(u_useLightMap)lightMapContribution=texture(u_lightMap,uvSet(u_lightMapTexCoord)).rgb*u_waterParams.w;
    vec3 lit=ambient+envDiffuse+envSpecular+base*lightMapContribution;
    float directionalLength=length(u_directionalDirection);
    if(directionalLength>0.0001){
      vec3 lightDirection=-u_directionalDirection/directionalLength;
      float visibility=shadowVisibility(n,lightDirection);
      lit+=evaluateLight(base,n,v,lightDirection,u_directionalColor,visibility,metallic,roughness);
    }
    for(int i=0;i<MAX_POINT_LIGHTS;i++){
      if(i>=u_pointCount)break;
      vec3 delta=u_pointPositions[i].xyz-v_worldPosition;
      float distanceToLight=length(delta);
      float range=max(u_pointPositions[i].w,0.0001);
      float normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);
      float attenuation=pow(normalizedDistance,max(u_pointColors[i].w,0.0001));
      lit+=evaluateLight(base,n,v,delta/max(distanceToLight,0.0001),u_pointColors[i].rgb,attenuation,metallic,roughness);
    }
    for(int i=0;i<MAX_SPOT_LIGHTS;i++){
      if(i>=u_spotCount)break;
      vec3 delta=u_spotPositions[i].xyz-v_worldPosition;
      float distanceToLight=length(delta);
      vec3 lightDirection=delta/max(distanceToLight,0.0001);
      float range=max(u_spotPositions[i].w,0.0001);
      float normalizedDistance=clamp(1.0-distanceToLight/range,0.0,1.0);
      float coneDot=dot(normalize(u_spotDirections[i].xyz),-lightDirection);
      float cone=smoothstep(u_spotDirections[i].w,u_spotColors[i].w,coneDot);
      float attenuation=pow(normalizedDistance,2.0)*cone;
      lit+=evaluateLight(base,n,v,lightDirection,u_spotColors[i].rgb,attenuation,metallic,roughness);
    }
    vec3 emissive=srgbToLinear(u_emissive);
    if(u_useEmissiveMap)emissive*=texture(u_emissiveMap,surfaceUv(u_emissiveTexCoord)).rgb;
    color=lit+emissive;
    float transmission=clamp(u_glassParams.x,0.0,1.0);
    if(transmission>0.0){
      float ior=max(1.0,u_glassParams.y);
      float dielectricF0=pow((ior-1.0)/(ior+1.0),2.0);
      float fresnel=dielectricF0+(1.0-dielectricF0)*pow(1.0-ndotv,5.0);
      vec3 absorption=pow(max(srgbToLinear(u_attenuationColor),vec3(0.0001)),vec3(max(u_glassParams.z,0.001)/max(u_glassParams.w,0.0001)));
      vec3 transmitted=mix(base,base*0.82+vec3(0.18),0.18)*(1.0-fresnel)*absorption;
      vec3 reflected=environmentSpecular(reflect(-v,n),max(0.02,roughness*0.55))*(0.35+fresnel*1.35);
      color=mix(color,transmitted+reflected,transmission);
      outputAlpha=mix(outputAlpha,clamp(0.08+fresnel*0.86+transmission*0.04,0.08,0.96),transmission);
    }
    color=finalizeColor(color,v_worldPosition);
  }else if(u_mode==6){
    vec3 n=surfaceNormal();vec3 v=normalize(u_cameraPosition-v_worldPosition);float ndotv=clamp(dot(n,v),0.0,1.0);float legacyFresnel=pow(1.0-ndotv,max(0.5,u_waterParams.x));float dielectricF0=pow((max(1.0,u_glassParams.y)-1.0)/(max(1.0,u_glassParams.y)+1.0),2.0);float physicalFresnel=dielectricF0+(1.0-dielectricF0)*pow(1.0-ndotv,max(0.5,u_waterParams.x));float enhanced=step(0.0001,u_waterMotion.y);float fresnel=mix(legacyFresnel,physicalFresnel,enhanced);float depthHint=clamp(1.0-abs(n.y),0.0,1.0);vec3 shallow=srgbToLinear(u_waterShallowColor);vec3 deep=srgbToLinear(u_waterDeepColor);vec3 water=mix(shallow,deep,clamp(depthHint*u_waterParams.z,0.0,1.0));vec3 reflection=environmentSpecular(reflect(-v,n),clamp(u_roughness,0.045,1.0));color=mix(water,reflection,clamp(fresnel*u_waterParams.y,0.0,1.0));if(enhanced>0.5&&length(u_directionalDirection)>0.0001){vec3 l=-normalize(u_directionalDirection);float ndotl=max(dot(n,l),0.0);if(ndotl>0.0){vec3 h=normalize(l+v);float rough=clamp(u_roughness,0.045,1.0);float d=distributionGGX(n,h,rough);float g=geometrySmith(n,v,l,rough);vec3 f=fresnelSchlick(max(dot(h,v),0.0),vec3(dielectricF0));float visibility=shadowVisibility(n,l);color+=(d*g*f/max(4.0*max(ndotv,0.0001)*ndotl,0.0001))*u_directionalColor*ndotl*visibility*(0.35+u_waterParams.y*0.65);}}float foam=smoothstep(0.72,1.0,1.0-abs(n.y))*u_waterMotion.w;color=mix(color,srgbToLinear(u_waterFoamColor),foam);color=finalizeColor(color+srgbToLinear(u_emissive),v_worldPosition);float legacyAlpha=0.82+fresnel*0.18;float transmissionAlpha=0.16+fresnel*0.80;outputAlpha=min(outputAlpha,mix(legacyAlpha,mix(legacyAlpha,transmissionAlpha,clamp(u_glassParams.x,0.0,1.0)),enhanced));
  }else if(u_mode==0){color=finalizeColor(base,v_worldPosition);}
  else if(u_mode==2){color=surfaceNormal()*0.5+0.5;}
  else if(u_mode==3){color=vec3(gl_FragCoord.z);}
  outColor=vec4(color,outputAlpha);
}`

interface WebGLDisjointTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number
  readonly GPU_DISJOINT_EXT: number
}


const pointFieldVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pointPosition;
layout(location=1) in vec4 a_pointColor;
layout(location=2) in vec2 a_pointAppearance;
uniform mat4 u_model;
uniform mat4 u_viewProjection;
uniform vec2 u_viewport;
uniform float u_directional;
out vec2 v_corner;
out vec4 v_color;
out float v_intensity;
vec2 quadCorner(int id){
  if(id==0)return vec2(-1.0,-1.0);
  if(id==1)return vec2( 1.0,-1.0);
  if(id==2)return vec2(-1.0, 1.0);
  if(id==3)return vec2(-1.0, 1.0);
  if(id==4)return vec2( 1.0,-1.0);
  return vec2(1.0,1.0);
}
void main(){
  vec4 clip;
  if(u_directional>0.5){
    vec3 direction=normalize((u_model*vec4(a_pointPosition,0.0)).xyz);
    clip=u_viewProjection*vec4(direction,0.0);
    clip.z=clip.w*0.999999;
  }else{
    clip=u_viewProjection*u_model*vec4(a_pointPosition,1.0);
  }
  vec2 corner=quadCorner(gl_VertexID);
  vec2 viewport=max(u_viewport,vec2(1.0));
  float sizePx=max(a_pointAppearance.x,0.35);
  clip.xy+=corner*(sizePx*2.0/viewport)*clip.w;
  gl_Position=clip;
  v_corner=corner;
  v_color=a_pointColor;
  v_intensity=max(a_pointAppearance.y,0.0);
}`
const pointFieldFragment = `#version 300 es
precision highp float;
in vec2 v_corner;
in vec4 v_color;
in float v_intensity;
uniform vec4 u_outputParams;
out vec4 outColor;
vec3 toneMap(vec3 color,float mode){
  if(mode<0.5)return color;
  if(mode<1.5)return color/(vec3(1.0)+color);
  vec3 x=max(vec3(0.0),color-0.004);return (x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);
}
vec3 linearToSrgb(vec3 c){vec3 lo=c*12.92;vec3 hi=1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055;return mix(hi,lo,lessThanEqual(c,vec3(0.0031308)));}
void main(){
  float radius=length(v_corner);
  float alpha=(1.0-smoothstep(0.72,1.0,radius))*v_color.a;
  if(alpha<=0.001)discard;
  vec3 color=max(v_color.rgb,vec3(0.0))*v_intensity*max(u_outputParams.x,0.0);
  color=toneMap(color,u_outputParams.y);
  if(u_outputParams.z>0.5)color=linearToSrgb(color);
  outColor=vec4(color,alpha);
}`

export class WebGL2Renderer implements RecoverableRenderer {
  readonly backend = 'webgl2' as const
  readonly stats: RendererStats = createRendererStats()
  capabilities: RendererCapabilities = { backend: 'webgl2', maxTextureSize: 0, maxPointLights: 8, maxSpotLights: 4, computeShaders: false, timestampQueries: false, instancing: true, offscreenCanvas: typeof OffscreenCanvas !== 'undefined', features: createRendererFeatures(), advanced: createRendererAdvancedCapabilities() }
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
  private gl?: WebGL2RenderingContext
  private regular?: ProgramState
  private instanced?: ProgramState
  private depthRegular?: DepthProgramState
  private depthInstanced?: DepthProgramState
  private outlineRegular?: OutlineProgramState
  private outlineInstanced?: OutlineProgramState
  private shadowFramebuffer?: WebGLFramebuffer
  private shadowTexture?: WebGLTexture
  private shadowMapSize = 0
  private readonly shadowMatrix = new Matrix4()
  private readonly shadowMatrices = [new Matrix4(), new Matrix4(), new Matrix4(), new Matrix4()]
  private readonly shadowSplits = new Float32Array(4)
  private readonly shadowMatrixData = new Float32Array(64)
  private shadowCascadeCount = 1
  private shadowCascadeLayers = 0
  private shadowAvailable = false
  private activeProgram?: WebGLProgram
  private readonly shaderPrograms = new Map<string, ShaderProgramState>()
  private readonly shaderUniformValues = new Float32Array(16 * 4)
  private readonly clearColor = new Color(0.04, 0.045, 0.06, 1)
  private readonly geometries = new Map<Geometry, WebGLGeometry>()
  private readonly instances = new Map<InstancedMesh, WebGLInstances>()
  private readonly textures = new Map<Texture, WebGLTextureState>()
  private readonly textureResidency = new TextureResidencyManager<Texture>()
  private readonly geometryResidency = new GeometryResidencyManager<Geometry>()
  private readonly renderQueueBuilder = new RenderQueueBuilder()
  private environmentTexture?: WebGLTextureState
  private environmentDiffuseTexture?: WebGLTextureState
  private environmentBrdfTexture?: WebGLTextureState
  private environmentBackgroundProgram?: EnvironmentBackgroundProgramState
  private proceduralClouds: RendererProceduralCloudState = resolveProceduralCloudState()
  private cloudNoiseTexture?: WebGLTextureState
  private cloudNoiseSeed = Number.NaN
  private pointFieldProgram?: PointFieldProgramState
  private readonly pointFields = new Map<PointField, WebGLPointFieldState>()
  private readonly environmentBackgroundInverseViewProjection = new Matrix4()
  private whiteTexture?: WebGLTextureState
  private frameIndex = 0
  private occlusionCuller = new HierarchicalDepthCuller(64)
  private clusterGrid = new ClusteredLightGrid()
  private contextLost = false
  private postProcessPipeline?: WebGLPostProcessPipeline
  private lastFrameTime = 0
  private waterTimeSeconds = 0
  private waterLastTimestamp = 0
  private maxPointLights = 8
  private maxSpotLights = 4
  private diagnostics?: RendererDiagnosticSink
  private readonly reportedDiagnostics = new Set<string>()
  private readonly lightReference = new Vector3()
  private readonly shadowFrustum = new Frustum()
  private readonly localPointLights: ClusteredPointLight[] = []
  private readonly pointPositions = new Float32Array(8 * 4)
  private readonly pointColors = new Float32Array(8 * 4)
  private readonly spotPositions = new Float32Array(4 * 4)
  private readonly spotDirections = new Float32Array(4 * 4)
  private readonly spotColors = new Float32Array(4 * 4)
  private gpuTimerExtension: WebGLDisjointTimerQueryExtension | null = null
  private alphaToCoverageCapable = false
  private alphaToCoverageActive = false
  private readonly gpuTimerQueries: WebGLQuery[] = []

  async initialize(options: RendererOptions): Promise<void> {
    if (this.gl) throw new Error('WebGL2Renderer is already initialized.')
    const gl = options.canvas.getContext('webgl2', { antialias: options.antialias ?? true, alpha: options.alpha ?? false, depth: true, powerPreference: options.powerPreference ?? 'high-performance' }) as WebGL2RenderingContext | null
    if (!gl) throw new Error('WebGL2 is unavailable on this canvas.')
    this.canvas = options.canvas
    this.gl = gl
    this.maxPointLights = Math.max(0, Math.min(8, Math.floor(options.maxPointLights ?? 8)))
    this.maxSpotLights = Math.max(0, Math.min(4, Math.floor(options.maxSpotLights ?? 4)))
    this.diagnostics = options.diagnostics
    this.colorManagement = resolveColorManagement(options.colorManagement)
    this.environmentLighting = resolveEnvironmentLighting(options.environmentLighting)
    this.shadowOptions = resolveShadowOptions(options.shadows)
    this.imageQuality = resolveImageQuality(options.imageQuality)
    this.atmosphere = resolveAtmosphere(options.atmosphere)
    this.colorGrading = resolveColorGrading(options.colorGrading)
    this.postProcessing = resolvePostProcessing(options.postProcessing)
    this.optimization = resolveOptimization(options.optimization)
    this.textureResidency.budgetBytes = this.optimization.textureMemoryBudgetMB * 1024 * 1024
    this.textureResidency.minimumUnusedFrames = this.optimization.textureEvictionFrames
    this.geometryResidency.budgetBytes = this.optimization.geometryMemoryBudgetMB * 1024 * 1024
    this.geometryResidency.minimumUnusedFrames = this.optimization.geometryEvictionFrames
    this.occlusionCuller = new HierarchicalDepthCuller({ baseResolution: this.optimization.hizResolution, historyFrames: this.optimization.occlusionHistoryFrames, minimumProjectedPixels: this.optimization.occlusionMinimumPixels })
    this.clusterGrid = new ClusteredLightGrid({ dimensions: this.optimization.clusterDimensions, maxLightsPerCluster: this.optimization.maxLightsPerCluster, maxVisibleLights: this.optimization.maxClusteredLights })
    this.gpuTimerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as WebGLDisjointTimerQueryExtension | null
    this.alphaToCoverageCapable = gl.getContextAttributes?.()?.antialias ?? (options.antialias ?? true)
    this.createPrograms()
    this.postProcessPipeline = new WebGLPostProcessPipeline(gl)
    this.whiteTexture = createWhiteTexture(gl)
    if(this.environmentMap)this.environmentTexture=this.uploadEnvironmentMap(this.environmentMap)
    if(this.proceduralClouds.enabled)this.ensureCloudNoiseTexture()
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.enable(gl.CULL_FACE)
    this.capabilities = {
      ...this.capabilities,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      maxPointLights: this.maxPointLights,
      maxSpotLights: this.maxSpotLights,
      timestampQueries: this.gpuTimerExtension !== null,
      features: createRendererFeatures({ xr: isHtmlCanvas(options.canvas), spotLights: true, shadows: true, environmentMaps: true, hdrEnvironment: true, imageBasedLighting: true, automaticRecovery: isHtmlCanvas(options.canvas), gpuPostProcessing: true, ssao: true, bloom: true, outlines: true, cascadedShadows: true, mipmapGeneration: true, gtao: true, bloomPyramid: true, invertedHullOutlines: true, fxaa: true, faceShadowMaps: true, transparentHair: true, hizOcclusion: true, clusteredLighting: true, staticBatching: true, textureStreaming: true, colorLuts: true, prefilteredEnvironmentMaps: true })
    }
    if (isHtmlCanvas(options.canvas)) {
      options.canvas.addEventListener('webglcontextlost', this.handleContextLost)
      options.canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    }
  }

  async recover(options: RendererRecoveryOptions = {}): Promise<void> {
    this.assertReady()
    options.onProgress?.(0.25, 'Checking WebGL2 context state')
    if (this.contextLost) throw new Error('The WebGL2 context is still lost; recovery continues when the browser dispatches webglcontextrestored.')
    options.onProgress?.(1, 'WebGL2 resources are ready for lazy restoration')
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.assertReady()
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.pixelRatio = Math.max(0.25, pixelRatio)
    const outputWidth = Math.max(1, Math.round(this.width * this.pixelRatio * this.imageQuality.renderScale))
    const outputHeight = Math.max(1, Math.round(this.height * this.pixelRatio * this.imageQuality.renderScale))
    if (this.canvas) { this.canvas.width = outputWidth; this.canvas.height = outputHeight }
    this.gl?.viewport(0, 0, outputWidth, outputHeight)
  }
  setClearColor(color: ColorInput): void { this.clearColor.set(color) }
  setColorManagement(options: Partial<RendererColorManagement>): void { this.colorManagement = resolveColorManagement({ ...this.colorManagement, ...options }) }
  setEnvironmentLighting(options: Partial<RendererEnvironmentLighting>): void { this.environmentLighting = resolveEnvironmentLighting({ ...this.environmentLighting, ...options }) }
  setEnvironmentMap(environment: RendererEnvironmentMap | undefined): void {
    this.environmentMap = environment ? { ...environment, pixels: environment.pixels, mipLevels: environment.mipLevels?.map(level=>({ ...level, pixels: level.pixels })), diffuse: environment.diffuse ? { ...environment.diffuse, pixels: environment.diffuse.pixels } : undefined, brdfLut: environment.brdfLut ? { ...environment.brdfLut, pixels: environment.brdfLut.pixels } : undefined } : undefined
    this.releaseEnvironmentTexture()
    if (environment && this.gl) this.environmentTexture = this.uploadEnvironmentMap(environment)
  }
  setProceduralClouds(clouds: RendererProceduralCloudInput | undefined): void {
    this.proceduralClouds = resolveProceduralCloudState(clouds ?? { enabled: false })
    if (!this.proceduralClouds.enabled) { this.releaseCloudNoiseTexture(); return }
    if (this.gl) this.ensureCloudNoiseTexture()
  }
  setShadowOptions(options: Partial<RendererShadowOptions>): void {
    const previousSize = this.shadowOptions.mapSize
    const previousCascades = this.shadowOptions.cascades
    this.shadowOptions = resolveShadowOptions({ ...this.shadowOptions, ...options })
    if (previousSize !== this.shadowOptions.mapSize || previousCascades !== this.shadowOptions.cascades) this.releaseShadowResources()
  }
  setImageQuality(options: Partial<RendererImageQuality>): void { const previous=this.imageQuality.renderScale; this.imageQuality = resolveImageQuality({ ...this.imageQuality, ...options }); if(previous!==this.imageQuality.renderScale&&this.gl)this.resize(this.width,this.height,this.pixelRatio) }
  setAtmosphere(options: Partial<RendererAtmosphere>): void { this.atmosphere = resolveAtmosphere({ ...this.atmosphere, ...options }) }
  setColorGrading(options: Partial<RendererColorGrading>): void { this.colorGrading = resolveColorGrading({ ...this.colorGrading, ...options }) }
  setPostProcessing(options: Partial<RendererPostProcessing>): void { this.postProcessing = resolvePostProcessing({ ...this.postProcessing, ...options }) }
  setOptimization(options: Partial<RendererOptimizationOptions>): void {
    const previous = this.optimization
    this.optimization = resolveOptimization({ ...this.optimization, ...options })
    this.textureResidency.budgetBytes = this.optimization.textureMemoryBudgetMB * 1024 * 1024
    this.textureResidency.minimumUnusedFrames = this.optimization.textureEvictionFrames
    this.geometryResidency.budgetBytes = this.optimization.geometryMemoryBudgetMB * 1024 * 1024
    this.geometryResidency.minimumUnusedFrames = this.optimization.geometryEvictionFrames
    if (previous.hizResolution !== this.optimization.hizResolution || previous.occlusionHistoryFrames !== this.optimization.occlusionHistoryFrames || previous.occlusionMinimumPixels !== this.optimization.occlusionMinimumPixels) {
      this.occlusionCuller = new HierarchicalDepthCuller({ baseResolution: this.optimization.hizResolution, historyFrames: this.optimization.occlusionHistoryFrames, minimumProjectedPixels: this.optimization.occlusionMinimumPixels })
    }
    this.clusterGrid = new ClusteredLightGrid({ dimensions: this.optimization.clusterDimensions, maxLightsPerCluster: this.optimization.maxLightsPerCluster, maxVisibleLights: this.optimization.maxClusteredLights })
  }

  render(scene: Scene, camera: Camera): void {
    this.assertReady()
    if (this.contextLost) return
    const started=now()
    camera.updateViewport(this.width, this.height)
    camera.updateMatrices()
    const scale=this.imageQuality.renderScale
    this.pollGpuTimers()
    const gpuQuery=this.beginGpuTimer()
    this.renderViewport(scene, camera, { x: 0, y: 0, width: Math.max(1, Math.round(this.width * this.pixelRatio * scale)), height: Math.max(1, Math.round(this.height * this.pixelRatio * scale)) }, { framebuffer: null, clear: true, updateScene: true, updateCamera: false, resetStats: true })
    this.endGpuTimer(gpuQuery)
    updateFrameStats(this.stats,started,this.lastFrameTime,scale);this.lastFrameTime=started
  }

  getContext(): WebGL2RenderingContext { this.assertReady(); return this.gl as WebGL2RenderingContext }
  async makeXRCompatible(): Promise<void> {
    const gl = this.getContext() as WebGL2RenderingContext & { makeXRCompatible?: () => Promise<void> }
    if (gl.makeXRCompatible) await gl.makeXRCompatible()
  }

  renderViewport(scene: Scene, camera: Camera, viewport: WebGLViewport, options: WebGLViewportRenderOptions = {}): void {
    this.assertReady()
    if (this.contextLost) return
    if (options.updateScene ?? true) this.advanceWaterClock()
    const gl = this.gl as WebGL2RenderingContext
    if (options.resetStats ?? true) resetStats(this.stats)
    this.collectDisposedResources()
    const transformStart = now()
    if (options.updateScene ?? true) {
      const transform = scene.updateWorldMatrixTracked()
      this.stats.transformNodesVisited = transform.visited
      this.stats.transformNodesUpdated = transform.updated
      this.stats.transformSubtreesSkipped = transform.skippedSubtrees
    }
    if (options.updateCamera ?? true) { camera.updateViewport(Math.max(1, viewport.width), Math.max(1, viewport.height)); camera.updateMatrices() }
    void transformStart
    this.frameIndex += 1
    if (this.optimization.hizOcclusion) this.occlusionCuller.beginFrame(camera, viewport.width, viewport.height)
    const queue = this.renderQueueBuilder.build(scene, camera, this.optimization, this.optimization.hizOcclusion ? this.occlusionCuller : undefined, viewport.height)
    this.stats.renderQueueBuildMs = queue.buildMs
    this.stats.renderQueueSortMs = queue.sortMs
    this.stats.boundsCacheHits = queue.boundsCacheHits
    this.stats.boundsCacheMisses = queue.boundsCacheMisses
    this.stats.renderItemAllocations = queue.itemAllocations
    this.stats.renderItemPoolSize = queue.itemPoolSize
    this.stats.staticBatches = queue.staticBatches
    this.stats.lodSwitches = queue.lodSwitches
    this.stats.lodLevelCounts = [...queue.lodLevelCounts]
    const lightBudget = this.optimization.clusteredLighting ? this.optimization.maxClusteredLights : this.maxPointLights
    const lightStarted = now()
    const lights = collectSceneLights(scene, lightBudget, this.lightReference.setFromMatrixPosition(camera.worldMatrix), this.maxSpotLights)
    if (this.optimization.clusteredLighting) this.clusterGrid.build(camera, lights.pointLights)
    this.stats.lightGridBuildMs = now() - lightStarted
    this.reportLightLimits(lights)
    this.stats.culledObjects += queue.culled
    this.stats.frustumCulledObjects += queue.frustumCulled
    this.stats.occlusionCulledObjects += queue.occlusionCulled
    this.stats.occlusionCandidates += queue.occlusionCandidates
    const clusterStats = this.clusterGrid.stats
    this.stats.clusterCount = this.optimization.clusteredLighting ? clusterStats.clusterCount : 0
    this.stats.clusteredLightReferences = this.optimization.clusteredLighting ? clusterStats.assignedLightReferences : 0
    this.stats.clusterOverflows = this.optimization.clusteredLighting ? clusterStats.overflowReferences : 0
    this.stats.maxClusterLights = this.optimization.clusteredLighting ? clusterStats.maximumClusterOccupancy : 0
    this.stats.visibleLights = this.optimization.clusteredLighting ? clusterStats.visibleLights : lights.pointLights.length
    this.stats.rejectedLights = this.optimization.clusteredLighting ? clusterStats.rejectedLights : Math.max(0, lights.pointCount - lights.pointLights.length)
    const shadowStarted = now()
    const shadowCasters = this.shadowOptions.enabled && lights.directionalSource?.castShadow
      ? this.renderQueueBuilder.buildShadowCasters(scene, this.optimization)
      : queue.opaque
    this.renderShadowMap(shadowCasters, lights, camera)
    this.stats.shadowPassMs = now() - shadowStarted
    const usePostProcess=this.postProcessing.enabled&&options.framebuffer==null&&Boolean(this.postProcessPipeline)
    if(usePostProcess)this.postProcessPipeline?.ensure(Math.max(1,viewport.width),Math.max(1,viewport.height))
    gl.bindFramebuffer(gl.FRAMEBUFFER,usePostProcess?this.postProcessPipeline?.target??null:options.framebuffer??null)
    this.alphaToCoverageActive = this.alphaToCoverageCapable && Number(gl.getParameter(gl.SAMPLES) ?? 0) > 1
    gl.viewport(viewport.x, viewport.y, Math.max(1, viewport.width), Math.max(1, viewport.height))
    if (options.clear ?? true) {
      gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }
    this.drawEnvironmentBackground(camera)
    this.drawPointFields(scene, camera, 'directional', viewport.width, viewport.height)
    this.activeProgram = undefined
    const mainStarted = now()
    for (const item of queue.opaque) { this.drawInvertedHull(item, camera); this.drawMesh(item, camera, lights) }
    this.drawPointFields(scene, camera, 'world', viewport.width, viewport.height)
    for (const item of queue.transparent) { this.drawInvertedHull(item, camera); this.drawMesh(item, camera, lights) }
    this.stats.mainPassMs = now() - mainStarted
    gl.bindVertexArray(null)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE)
    this.alphaToCoverageActive = false
    this.activeProgram = undefined
    const postStarted = now()
    if(usePostProcess){this.postProcessPipeline?.composite(this.postProcessing,this.imageQuality,this.colorGrading,options.framebuffer??null);this.stats.postProcessPasses+=this.postProcessPipeline?.lastPassCount??1}
    this.stats.postProcessMs = now() - postStarted
    const residencyStarted = now()
    this.stats.textureEvictions += this.textureResidency.enforce(this.frameIndex)
    this.stats.geometryEvictions += this.geometryResidency.enforce(this.frameIndex)
    this.stats.residencyMs = now() - residencyStarted
  }

  private drawPointFields(scene: Scene, camera: Camera, space: 'world' | 'directional', viewportWidth: number, viewportHeight: number): void {
    const gl = this.gl as WebGL2RenderingContext
    const program = this.pointFieldProgram
    if (!program) return
    let drew = false
    scene.traverse(node => {
      if (!(node instanceof PointField) || !node.worldVisible || node.disposed || node.space !== space || node.count === 0) return
      const gpu = this.getPointField(node)
      if (!drew) {
        gl.useProgram(program.program)
        gl.uniformMatrix4fv(program.viewProjection, false, camera.viewProjectionMatrix.elements)
        gl.uniform2f(program.viewport, Math.max(1, viewportWidth), Math.max(1, viewportHeight))
        const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : 2
        gl.uniform4f(program.outputParams, this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, 0)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)
        gl.depthMask(false)
        gl.disable(gl.CULL_FACE)
        this.stats.pipelineChanges += 1
        drew = true
      }
      gl.uniformMatrix4fv(program.model, false, node.worldMatrix.elements)
      gl.uniform1f(program.directional, node.space === 'directional' ? 1 : 0)
      gl.bindVertexArray(gpu.vao)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, gpu.count)
      this.stats.uniformUpdates += 2
      this.stats.drawCalls += 1
      this.stats.visibleObjects += 1
      this.stats.triangles += gpu.count * 2
      this.stats.instancesRendered += gpu.count
      this.stats.instancedDrawCalls += 1
    })
    if (drew) {
      gl.bindVertexArray(null)
      gl.depthMask(true)
      gl.disable(gl.BLEND)
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.BACK)
      this.activeProgram = undefined
    }
  }

  private getPointField(field: PointField): WebGLPointFieldState {
    const cached = this.pointFields.get(field)
    if (cached && cached.version === field.pointVersion) return cached
    const gl = this.gl as WebGL2RenderingContext
    const appearance = new Float32Array(field.count * 2)
    for (let index = 0; index < field.count; index += 1) { appearance[index * 2] = field.sizes[index] ?? 1; appearance[index * 2 + 1] = field.intensities[index] ?? 1 }

    if (cached && cached.count === field.count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, cached.positionBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, field.positions)
      gl.bindBuffer(gl.ARRAY_BUFFER, cached.colorBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, field.colors)
      gl.bindBuffer(gl.ARRAY_BUFFER, cached.appearanceBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, appearance)
      cached.version = field.pointVersion
      this.stats.geometryUploads += 3
      return cached
    }

    if (cached) {
      gl.deleteVertexArray(cached.vao)
      gl.deleteBuffer(cached.positionBuffer)
      gl.deleteBuffer(cached.colorBuffer)
      gl.deleteBuffer(cached.appearanceBuffer)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - cached.bytes)
    }
    const vao = gl.createVertexArray()
    const positionBuffer = gl.createBuffer()
    const colorBuffer = gl.createBuffer()
    const appearanceBuffer = gl.createBuffer()
    if (!vao || !positionBuffer || !colorBuffer || !appearanceBuffer) throw new Error('WebGL2 could not allocate PointField GPU resources.')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, field.positions, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 1)
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, field.colors, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1)
    gl.bindBuffer(gl.ARRAY_BUFFER, appearanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, appearance, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1)
    gl.bindVertexArray(null)
    const bytes = field.positions.byteLength + field.colors.byteLength + appearance.byteLength
    const state = { vao, positionBuffer, colorBuffer, appearanceBuffer, count: field.count, version: field.pointVersion, bytes }
    this.pointFields.set(field, state)
    this.stats.geometryMemory += bytes
    this.stats.geometryUploads += 3
    this.stats.gpuResourceCreations += 4
    this.stats.gpuResourceCreationsThisFrame += 4
    return state
  }

  private ensureCloudNoiseTexture(): WebGLTextureState | undefined {
    const gl = this.gl
    if (!gl || !this.proceduralClouds.enabled) return undefined
    if (this.cloudNoiseTexture && this.cloudNoiseSeed === this.proceduralClouds.seed) return this.cloudNoiseTexture
    this.releaseCloudNoiseTexture()
    const size = 128
    const pixels = createProceduralCloudNoise(this.proceduralClouds.seed, size)
    const texture = gl.createTexture()
    if (!texture) throw new Error('WebGL2 could not allocate procedural cloud noise texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    const state: WebGLTextureState = { texture, version: 1, bytes: pixels.byteLength, width: size, height: size, colorSpace: 'linear', lastUsedFrame: this.frameIndex }
    this.cloudNoiseTexture = state
    this.cloudNoiseSeed = this.proceduralClouds.seed
    this.stats.textureMemory += state.bytes
    this.stats.textureUploads += 1
    this.stats.gpuResourceCreations += 1
    this.stats.gpuResourceCreationsThisFrame += 1
    return state
  }

  private releaseCloudNoiseTexture(): void {
    if (!this.cloudNoiseTexture) { this.cloudNoiseSeed = Number.NaN; return }
    this.gl?.deleteTexture(this.cloudNoiseTexture.texture)
    this.stats.textureMemory = Math.max(0, this.stats.textureMemory - this.cloudNoiseTexture.bytes)
    this.cloudNoiseTexture = undefined
    this.cloudNoiseSeed = Number.NaN
  }

  private drawEnvironmentBackground(camera: Camera): void {
    const environment = this.environmentMap
    const texture = this.environmentTexture
    if (!environment?.background || !texture) return
    const gl = this.gl as WebGL2RenderingContext
    const program = this.environmentBackgroundProgram ??= createEnvironmentBackgroundProgramState(gl)
    this.environmentBackgroundInverseViewProjection.copy(camera.viewProjectionMatrix).invert()
    const cameraElements = camera.worldMatrix.elements
    const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : this.colorManagement.toneMapping === 'neutral' ? 3 : 2
    gl.useProgram(program.program)
    gl.uniformMatrix4fv(program.inverseViewProjection, false, this.environmentBackgroundInverseViewProjection.elements)
    gl.uniform3f(program.cameraPosition, cameraElements[12] ?? 0, cameraElements[13] ?? 0, cameraElements[14] ?? 0)
    gl.uniform4f(program.params, environment.backgroundIntensity ?? 1, environment.rotation ?? 0, environment.format === 'rgba16f-linear' ? 1 : 0, 0)
    gl.uniform4f(program.outputParams, this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, 0)
    const clouds = this.proceduralClouds
    gl.uniform4f(program.cloudParams, clouds.enabled ? 1 : 0, clouds.coverage, clouds.density, clouds.scale)
    gl.uniform4f(program.cloudMotion, clouds.offset[0], clouds.offset[1], clouds.evolution, 0)
    gl.uniform4f(program.cloudSun, clouds.sunDirection[0], clouds.sunDirection[1], clouds.sunDirection[2], clouds.sunIntensity)
    gl.uniform4f(program.cloudShape, clouds.macroScale, clouds.detailScale, clouds.detailStrength, clouds.warpStrength)
    gl.uniform4f(program.cloudHorizon, clouds.edgeSoftness, clouds.horizonVisibility, clouds.horizonSoftness, clouds.silverLiningStrength)
    gl.uniform4f(program.cloudLighting, clouds.shadowStrength, clouds.highlightStrength, clouds.horizonExtension, clouds.horizonCompression)
    gl.uniform4f(program.cloudDetailMotion, clouds.detailOffset[0], clouds.detailOffset[1], clouds.detailEvolution, clouds.horizonAtmosphericFade)
    gl.uniform3f(program.cloudAmbientColor, clouds.ambientColor[0], clouds.ambientColor[1], clouds.ambientColor[2])
    gl.uniform3f(program.cloudShadowColor, clouds.shadowColor[0], clouds.shadowColor[1], clouds.shadowColor[2])
    gl.uniform3f(program.cloudLightColor, clouds.lightColor[0], clouds.lightColor[1], clouds.lightColor[2])
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.uniform1i(program.environmentMap, 0)
    const cloudNoise = clouds.enabled ? this.ensureCloudNoiseTexture() : undefined
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, (cloudNoise ?? this.whiteTexture as WebGLTextureState).texture)
    gl.uniform1i(program.cloudNoiseMap, 1)
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK)
    this.stats.drawCalls += 1; this.stats.triangles += 1; this.stats.pipelineChanges += 1
  }

  private advanceWaterClock(): void {
    const timestamp=now();const delta=this.waterLastTimestamp>0?Math.min(0.25,Math.max(0,(timestamp-this.waterLastTimestamp)/1000)):0;this.waterLastTimestamp=timestamp;this.waterTimeSeconds=(this.waterTimeSeconds+delta)%4096
  }

  private renderShadowMap(items: readonly RenderItem[], lights: SceneLightSummary, camera: Camera): void {
    this.shadowAvailable = false
    const source = lights.directionalSource
    if (!this.shadowOptions.enabled || !source?.castShadow) return
    this.stats.shadowedLights = 1
    let hasCaster = false
    for (const item of items) {
      if (item.mesh.castShadow && !item.material.transparent) { hasCaster = true; break }
    }
    if (!hasCaster) return
    const frames=createDirectionalShadowCascades(camera,lights.directionalDirection,this.shadowOptions)
    if(frames.length===0)return
    this.shadowCascadeCount=frames.length
    this.shadowSplits.fill(this.shadowOptions.maxDistance)
    for(const frame of frames){
      const matrix=this.shadowMatrices[frame.index]
      if(matrix){matrix.copy(frame.matrix);this.shadowMatrixData.set(matrix.elements,frame.index*16)}
      this.shadowSplits[frame.index]=frame.splitFar
    }
    this.shadowMatrix.copy(camera.viewMatrix)
    this.ensureShadowResources()
    const gl = this.gl as WebGL2RenderingContext
    const framebuffer = this.shadowFramebuffer
    if (!framebuffer || !this.shadowTexture || !this.depthRegular || !this.depthInstanced) return
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.colorMask(false, false, false, false);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);gl.clearDepth(1)
    for(const frame of frames){
      const shadowFrustum=this.shadowFrustum.setFromProjectionMatrix(frame.matrix)
      gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,this.shadowTexture,0,frame.index)
      gl.viewport(0,0,this.shadowMapSize,this.shadowMapSize);gl.clear(gl.DEPTH_BUFFER_BIT)
      let active: WebGLProgram | undefined
      for (const entry of items) {
        const mesh=entry.mesh
        if(!mesh.castShadow || entry.material.transparent) continue
        if(this.optimization.shadowCasterCulling&&!shadowFrustum.intersectsBox(entry.worldBounds))continue
        const program = mesh instanceof InstancedMesh ? this.depthInstanced : this.depthRegular
        if (active !== program.program) {gl.useProgram(program.program);gl.uniformMatrix4fv(program.uniforms.lightViewProjection,false,frame.matrix.elements);active=program.program;this.stats.pipelineChanges+=1}
        const surface=materialSurface(entry.material)
        gl.uniformMatrix4fv(program.uniforms.model,false,mesh.worldMatrix.elements)
        gl.uniform4f(program.uniforms.baseColor,surface?.color.r??1,surface?.color.g??1,surface?.color.b??1,surface?.color.a??1)
        gl.uniform1f(program.uniforms.alphaCutoff,surface?.alphaCutoff??0)
        gl.uniform1i(program.uniforms.useBaseColorMap,surface?.baseColor.texture?.ready?1:0)
        gl.uniform1i(program.uniforms.baseColorTexCoord,surface?.baseColor.texCoord??0)
        gl.uniform4f(program.uniforms.textureTransform,surface?.textureScale[0]??1,surface?.textureScale[1]??1,surface?.textureOffset[0]??0,surface?.textureOffset[1]??0)
        gl.uniform1f(program.uniforms.textureRotation,surface?.textureRotation??0)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D,surface?.baseColor.texture?.ready?this.getTexture(surface.baseColor.texture).texture:(this.whiteTexture as WebGLTextureState).texture)
        if(entry.material.side==='double')gl.disable(gl.CULL_FACE);else{gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT)}
        this.stats.uniformUpdates+=1
        const gpu=this.getGeometry(mesh.geometry);gl.bindVertexArray(gpu.vao)
        if(mesh instanceof InstancedMesh){this.bindInstances(mesh);this.drawGeometryRange(gpu,entry.start,entry.count,mesh.drawCount);this.stats.triangles+=(entry.count/3)*mesh.drawCount;this.stats.instancedDrawCalls+=1;this.stats.instancesRendered+=mesh.drawCount}
        else {this.drawGeometryRange(gpu,entry.start,entry.count,1);this.stats.triangles+=entry.count/3}
        this.stats.drawCalls+=1;this.stats.shadowDrawCalls+=1
      }
    }
    gl.colorMask(true,true,true,true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.activeProgram=undefined;this.shadowAvailable=true
  }

  private ensureShadowResources(): void {
    const gl = this.gl as WebGL2RenderingContext
    const size = this.shadowOptions.mapSize
    const layers=Math.max(1,Math.min(4,this.shadowOptions.cascades))
    if (this.shadowFramebuffer && this.shadowTexture && this.shadowMapSize === size && this.shadowCascadeLayers===layers) return
    this.releaseShadowResources()
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) throw new Error('WebGL2 failed to allocate directional shadow resources.')
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture)
    gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.DEPTH_COMPONENT24,size,size,layers,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer)
    gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,texture,0,0)
    gl.drawBuffers([gl.NONE])
    gl.readBuffer(gl.NONE)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
      throw new Error(`WebGL2 directional shadow framebuffer is incomplete (${status}).`)
    }
    this.shadowTexture = texture
    this.shadowFramebuffer = framebuffer
    this.shadowMapSize = size
    this.shadowCascadeLayers=layers
    this.stats.textureMemory += size * size * layers * 4
  }

  private releaseShadowResources(): void {
    const gl = this.gl
    if (gl) {
      if (this.shadowTexture) gl.deleteTexture(this.shadowTexture)
      if (this.shadowFramebuffer) gl.deleteFramebuffer(this.shadowFramebuffer)
    }
    if (this.shadowMapSize > 0) this.stats.textureMemory = Math.max(0, this.stats.textureMemory - this.shadowMapSize * this.shadowMapSize * Math.max(1,this.shadowCascadeLayers) * 4)
    this.shadowTexture = undefined
    this.shadowFramebuffer = undefined
    this.shadowMapSize = 0
    this.shadowCascadeLayers=0
    this.shadowAvailable = false
  }

  private beginGpuTimer(): WebGLQuery | null {
    const gl=this.gl;const extension=this.gpuTimerExtension
    if(!gl||!extension||this.gpuTimerQueries.length>=4)return null
    const query=gl.createQuery()
    if(!query)return null
    gl.beginQuery(extension.TIME_ELAPSED_EXT,query)
    return query
  }

  private endGpuTimer(query: WebGLQuery | null): void {
    if(!query||!this.gl||!this.gpuTimerExtension)return
    this.gl.endQuery(this.gpuTimerExtension.TIME_ELAPSED_EXT)
    this.gpuTimerQueries.push(query)
  }

  private pollGpuTimers(): void {
    const gl=this.gl;const extension=this.gpuTimerExtension
    if(!gl||!extension)return
    while(this.gpuTimerQueries.length>0){
      const query=this.gpuTimerQueries[0]
      if(!query||!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))break
      this.gpuTimerQueries.shift()
      const disjoint=Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT))
      if(!disjoint){const elapsed=Number(gl.getQueryParameter(query,gl.QUERY_RESULT));if(Number.isFinite(elapsed))this.stats.gpuFrameMs=elapsed/1_000_000}
      else this.stats.gpuFrameMs=null
      gl.deleteQuery(query)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    if (gl) {
      for (const gpu of this.geometries.values()) this.deleteGeometry(gl, gpu)
      for (const instance of this.instances.values()) { gl.deleteBuffer(instance.matrixBuffer); gl.deleteBuffer(instance.colorBuffer) }
      for (const texture of this.textures.values()) gl.deleteTexture(texture.texture)
      if (this.whiteTexture) gl.deleteTexture(this.whiteTexture.texture)
      if (this.environmentTexture) gl.deleteTexture(this.environmentTexture.texture)
      if (this.environmentDiffuseTexture) gl.deleteTexture(this.environmentDiffuseTexture.texture)
      if (this.environmentBrdfTexture) gl.deleteTexture(this.environmentBrdfTexture.texture)
      if (this.cloudNoiseTexture) gl.deleteTexture(this.cloudNoiseTexture.texture)
      this.releaseShadowResources()
    this.postProcessPipeline?.dispose()
    this.postProcessPipeline=undefined
      if (this.regular) gl.deleteProgram(this.regular.program)
      if (this.instanced) gl.deleteProgram(this.instanced.program)
      if (this.depthRegular) gl.deleteProgram(this.depthRegular.program)
      if (this.depthInstanced) gl.deleteProgram(this.depthInstanced.program)
      if (this.outlineRegular) gl.deleteProgram(this.outlineRegular.program)
      if (this.outlineInstanced) gl.deleteProgram(this.outlineInstanced.program)
      if (this.environmentBackgroundProgram) gl.deleteProgram(this.environmentBackgroundProgram.program)
      if (this.pointFieldProgram) gl.deleteProgram(this.pointFieldProgram.program)
      for (const point of this.pointFields.values()) { gl.deleteVertexArray(point.vao); gl.deleteBuffer(point.positionBuffer); gl.deleteBuffer(point.colorBuffer); gl.deleteBuffer(point.appearanceBuffer) }
      for (const state of this.shaderPrograms.values()) gl.deleteProgram(state.program)
      for (const query of this.gpuTimerQueries) gl.deleteQuery(query)
    }
    if (this.canvas && isHtmlCanvas(this.canvas)) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    }
    this.gpuTimerQueries.length=0
    this.gpuTimerExtension=null
    this.geometries.clear()
    this.instances.clear()
    this.pointFields.clear()
    this.textures.clear()
    this.textureResidency.clear()
    this.geometryResidency.clear()
    this.environmentTexture = undefined
    this.environmentDiffuseTexture = undefined
    this.environmentBrdfTexture = undefined
    this.cloudNoiseTexture = undefined
    this.gl = undefined
    this.regular = undefined
    this.instanced = undefined
    this.depthRegular = undefined
    this.depthInstanced = undefined
    this.outlineRegular = undefined
    this.environmentBackgroundProgram = undefined
    this.pointFieldProgram = undefined
    this.outlineInstanced = undefined
    this.shaderPrograms.clear()
    this.whiteTexture = undefined
    this.canvas = undefined
  }

  private drawInvertedHull(item: RenderItem, camera: Camera): void {
    const material = item.material
    const outlines = this.postProcessing.outlines
    if (!outlines.enabled || (outlines.mode !== 'inverted-hull' && outlines.mode !== 'hybrid')) return
    if (!(material instanceof StandardMaterial) || material.shadingModel !== 'mtoon' || material.mtoonOutlineWidth <= 0) return
    const gl = this.gl as WebGL2RenderingContext
    const mesh = item.mesh
    const program = mesh instanceof InstancedMesh ? this.outlineInstanced : this.outlineRegular
    if (!program) return
    const gpu = this.getGeometry(mesh.geometry)
    gl.useProgram(program.program)
    this.activeProgram = program.program
    gl.uniformMatrix4fv(program.uniforms.model, false, mesh.worldMatrix.elements)
    gl.uniformMatrix4fv(program.uniforms.viewProjection, false, camera.viewProjectionMatrix.elements)
    gl.uniform1f(program.uniforms.width, material.mtoonOutlineWidth * Math.max(0.5, outlines.thickness))
    gl.uniform1f(program.uniforms.mode, material.mtoonOutlineWidthMode === 'screenCoordinates' ? 2 : 1)
    const outlineMix=material.mtoonOutlineLightingMix
    gl.uniform3f(program.uniforms.color, material.mtoonOutlineColor.r*((1-outlineMix)+material.baseColor.r*outlineMix), material.mtoonOutlineColor.g*((1-outlineMix)+material.baseColor.g*outlineMix), material.mtoonOutlineColor.b*((1-outlineMix)+material.baseColor.b*outlineMix))
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.FRONT)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(gpu.vao)
    if (mesh instanceof InstancedMesh) {
      this.bindInstances(mesh)
      this.drawGeometryRange(gpu, item.start, item.count, mesh.drawCount)
      this.stats.triangles += (item.count / 3) * mesh.drawCount
      this.stats.instancedDrawCalls += 1
      this.stats.instancesRendered += mesh.drawCount
    } else {
      this.drawGeometryRange(gpu, item.start, item.count, 1)
      this.stats.triangles += item.count / 3
    }
    this.stats.drawCalls += 1
    this.stats.pipelineChanges += 1
  }

  private uploadEnvironmentMap(environment: RendererEnvironmentMap): WebGLTextureState {
    const specular = this.uploadEnvironmentTexture(environment, environment.mipLevels, environment.format ?? 'rgba8-srgb', environment.label ?? 'Sekai64 environment specular', true)
    this.environmentDiffuseTexture = environment.diffuse ? this.uploadEnvironmentTexture(environment.diffuse, undefined, environment.format ?? 'rgba8-srgb', `${environment.label ?? 'Sekai64 environment'} diffuse`, false) : undefined
    this.environmentBrdfTexture = environment.brdfLut ? this.uploadEnvironmentTexture(environment.brdfLut, undefined, 'rgba16f-linear', `${environment.label ?? 'Sekai64 environment'} BRDF LUT`, false, true) : undefined
    return specular
  }

  private uploadEnvironmentTexture(level: { width: number; height: number; pixels: RendererEnvironmentMap['pixels'] }, mipLevels: RendererEnvironmentMap['mipLevels'], format: 'rgba8-srgb' | 'rgba16f-linear', label: string, generateMissingMipmaps: boolean, clampU = false): WebGLTextureState {
    const gl = this.gl as WebGL2RenderingContext
    const texture = gl.createTexture()
    if (!texture) throw new Error(`WebGL2 failed to allocate ${label}.`)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    const hdr = format === 'rgba16f-linear'
    const upload = (mip: number, width: number, height: number, pixels: RendererEnvironmentMap['pixels']): void => {
      if (hdr && !(pixels instanceof Float32Array)) throw new Error(`${label} expects Float32Array pixels for rgba16f-linear.`)
      if (!hdr && pixels instanceof Float32Array) throw new Error(`${label} expects 8-bit pixels for rgba8-srgb.`)
      gl.texImage2D(gl.TEXTURE_2D, mip, hdr ? gl.RGBA16F : gl.SRGB8_ALPHA8, width, height, 0, gl.RGBA, hdr ? gl.FLOAT : gl.UNSIGNED_BYTE, pixels)
    }
    upload(0, level.width, level.height, level.pixels)
    for (let index = 0; index < (mipLevels?.length ?? 0); index += 1) { const mip = mipLevels?.[index]; if (mip) upload(index + 1, mip.width, mip.height, mip.pixels) }
    const canLinearFilter = !hdr || Boolean(gl.getExtension('OES_texture_float_linear'))
    const hasMipLevels = Boolean(mipLevels?.length)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, hasMipLevels || generateMissingMipmaps ? (canLinearFilter ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST) : (canLinearFilter ? gl.LINEAR : gl.NEAREST))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, canLinearFilter ? gl.LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, clampU ? gl.CLAMP_TO_EDGE : gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (!hasMipLevels && generateMissingMipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    const bytesPerPixel = hdr ? 8 : 4
    const bytes = level.width * level.height * bytesPerPixel + (mipLevels?.reduce((sum, mip) => sum + mip.width * mip.height * bytesPerPixel, 0) ?? (generateMissingMipmaps ? Math.ceil(level.width * level.height * bytesPerPixel / 3) : 0))
    this.stats.textureMemory += bytes
    this.stats.textureUploads += 1
    return { texture, version: 0, bytes, width: level.width, height: level.height, colorSpace: hdr ? 'linear' : 'srgb', lastUsedFrame: this.frameIndex }
  }

  private releaseEnvironmentTexture(): void {
    if (!this.gl) { this.environmentTexture = undefined; this.environmentDiffuseTexture = undefined; this.environmentBrdfTexture = undefined; return }
    for (const state of [this.environmentTexture, this.environmentDiffuseTexture, this.environmentBrdfTexture]) {
      if (!state) continue
      this.gl.deleteTexture(state.texture)
      this.stats.textureMemory = Math.max(0, this.stats.textureMemory - state.bytes)
    }
    this.environmentTexture = undefined
    this.environmentDiffuseTexture = undefined
    this.environmentBrdfTexture = undefined
  }

  private evictTexture(texture: Texture, state: WebGLTextureState): void {
    if (this.textures.get(texture) !== state || !this.gl) return
    this.gl.deleteTexture(state.texture)
    this.textures.delete(texture)
    this.stats.textureMemory = Math.max(0, this.stats.textureMemory - state.bytes)
  }

  private drawMesh(item: RenderItem, camera: Camera, lights: SceneLightSummary): void {
    const mesh = item.mesh
    const material = item.material
    const worldBounds = item.worldBounds
    if (material instanceof ShaderMaterial) {
      this.drawShaderMesh(item, camera, material)
      return
    }
    const gl = this.gl as WebGL2RenderingContext
    const surface = materialSurface(material)
    if (!surface) return
    const program = mesh instanceof InstancedMesh ? this.instanced as ProgramState : this.regular as ProgramState
    if (this.activeProgram !== program.program) {
      gl.useProgram(program.program)
      this.activeProgram = program.program
      this.stats.pipelineChanges += 1
      gl.uniformMatrix4fv(program.uniforms.viewProjection, false, camera.viewProjectionMatrix.elements)
      gl.uniform3f(program.uniforms.cameraPosition, this.lightReference.x, this.lightReference.y, this.lightReference.z)
      gl.uniform3f(program.uniforms.ambient, ...lights.ambient)
      gl.uniform3f(program.uniforms.directionalColor, ...lights.directionalColor)
      gl.uniform3f(program.uniforms.directionalDirection, ...lights.directionalDirection)
      this.spotPositions.fill(0)
      this.spotDirections.fill(0)
      this.spotColors.fill(0)
      for (let index = 0; index < lights.spotLights.length; index += 1) {
        const light = lights.spotLights[index]
        if (!light) continue
        this.spotPositions.set(light.positionRange, index * 4)
        this.spotDirections.set(light.directionOuter, index * 4)
        this.spotColors.set(light.colorInnerDecay, index * 4)
      }
      gl.uniform4fv(program.uniforms.spotPositions, this.spotPositions)
      gl.uniform4fv(program.uniforms.spotDirections, this.spotDirections)
      gl.uniform4fv(program.uniforms.spotColors, this.spotColors)
      gl.uniform1i(program.uniforms.spotCount, lights.selectedSpotCount)
      const toneMode = this.colorManagement.toneMapping === 'none' ? 0 : this.colorManagement.toneMapping === 'reinhard' ? 1 : this.colorManagement.toneMapping === 'neutral' ? 3 : 2
      gl.uniform4f(program.uniforms.outputParams, this.colorManagement.exposure, toneMode, this.colorManagement.outputColorSpace === 'srgb' ? 1 : 0, this.imageQuality.dithering ? 1 : 0)
      const fogMode = this.atmosphere.mode === 'linear' ? 1 : this.atmosphere.mode === 'exp2' ? 2 : 0
      gl.uniform3f(program.uniforms.atmosphereColor, ...this.atmosphere.color)
      gl.uniform4f(program.uniforms.atmosphereParams, fogMode, this.atmosphere.near, this.atmosphere.far, this.atmosphere.density)
      gl.uniform4f(program.uniforms.atmosphereParams2, this.atmosphere.baseHeight, this.atmosphere.heightFalloff, this.atmosphere.maxOpacity, this.atmosphere.enabled ? 1 : 0)
      gl.uniform4f(program.uniforms.gradingParams, this.colorGrading.enabled ? 1 : 0, this.colorGrading.saturation, this.colorGrading.contrast, this.colorGrading.brightness)
      gl.uniform4f(program.uniforms.gradingParams2, this.colorGrading.temperature, this.colorGrading.tint, this.colorGrading.vignette, this.colorGrading.vignetteSoftness)
      gl.uniform4f(program.uniforms.gradingParams3, this.colorGrading.highlightGlow, this.colorGrading.highlightThreshold, 0, 0)
      gl.uniform2f(program.uniforms.viewportSize, this.width * this.pixelRatio, this.height * this.pixelRatio)
      const hasSceneEnvironment = lights.environmentSky.some(value => value > 0) || lights.environmentGround.some(value => value > 0)
      const environmentSky = hasSceneEnvironment ? lights.environmentSky : linearColor(this.environmentLighting.skyColor)
      const environmentGround = hasSceneEnvironment ? lights.environmentGround : linearColor(this.environmentLighting.groundColor)
      const environmentIntensity = this.environmentLighting.enabled ? (hasSceneEnvironment ? 1 : this.environmentLighting.intensity) : 0
      const environmentSpecular = this.environmentLighting.enabled ? (hasSceneEnvironment ? lights.environmentSpecular : this.environmentLighting.specularIntensity) : 0
      gl.uniform3f(program.uniforms.environmentSky, ...environmentSky)
      gl.uniform3f(program.uniforms.environmentGround, ...environmentGround)
      gl.uniform4f(program.uniforms.environmentParams, environmentIntensity, environmentSpecular, 0, 0)
      gl.uniformMatrix4fv(program.uniforms.shadowMatrix,false,this.shadowMatrix.elements)
      gl.uniformMatrix4fv(program.uniforms.shadowMatrices,false,this.shadowMatrixData)
      gl.uniform4fv(program.uniforms.shadowSplits,this.shadowSplits)
      gl.uniform4f(program.uniforms.shadowCascadeParams,this.shadowCascadeCount,this.shadowOptions.maxDistance,this.shadowOptions.splitLambda,this.shadowOptions.stabilize?1:0)
      const shadowFilter=this.shadowOptions.filter==='hard'?0:this.shadowOptions.filter==='pcf3'?1:this.shadowOptions.filter==='pcf5'?2:3
      gl.uniform4f(program.uniforms.shadowQuality,shadowFilter,this.shadowOptions.cascadeBlend,this.shadowOptions.distanceFade,0)
      gl.uniform4f(program.uniforms.shadowParams, this.shadowOptions.bias, this.shadowOptions.normalBias, this.shadowOptions.softness, this.shadowAvailable ? 1 : 0)
      gl.uniform1i(program.uniforms.baseColorMap, 0)
      gl.uniform1i(program.uniforms.metallicRoughnessMap, 1)
      gl.uniform1i(program.uniforms.normalMap, 2)
      gl.uniform1i(program.uniforms.emissiveMap, 3)
      gl.uniform1i(program.uniforms.occlusionMap, 4)
      gl.uniform1i(program.uniforms.metallicMap, 5)
      gl.uniform1i(program.uniforms.roughnessMap, 6)
      gl.uniform1i(program.uniforms.shadowMap, 7)
      gl.activeTexture(gl.TEXTURE7)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.shadowTexture ?? null)
      gl.uniform1i(program.uniforms.faceShadowMap,8)
      gl.uniform1i(program.uniforms.environmentMap,9)
      gl.uniform1i(program.uniforms.lightMap,10)
      gl.uniform1i(program.uniforms.environmentDiffuseMap,11)
      gl.uniform1i(program.uniforms.environmentBrdfLut,12)
      gl.uniform1i(program.uniforms.detailNormalMap,13)
      gl.uniform1i(program.uniforms.detailRoughnessMap,14)
      gl.uniform1i(program.uniforms.detailHeightMap,15)
      gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,(this.environmentTexture??this.whiteTexture as WebGLTextureState).texture)
      gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,(this.environmentDiffuseTexture??this.environmentTexture??this.whiteTexture as WebGLTextureState).texture)
      gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,(this.environmentBrdfTexture??this.whiteTexture as WebGLTextureState).texture)
      const environmentMaxLod=this.environmentMap?.mipLevels?.length??(this.environmentTexture?Math.max(0,Math.floor(Math.log2(Math.max(this.environmentTexture.width,this.environmentTexture.height)))):0)
      gl.uniform4f(program.uniforms.environmentMapParams,this.environmentTexture?1:0,this.environmentMap?.intensity??this.environmentLighting.intensity,this.environmentMap?.rotation??this.environmentLighting.rotation,0)
      gl.uniform4f(program.uniforms.environmentIblParams,this.environmentDiffuseTexture?1:0,this.environmentBrdfTexture?1:0,environmentMaxLod,0)
    }
    const localPointLights = this.optimization.clusteredLighting && worldBounds
      ? this.clusterGrid.selectForBounds(worldBounds, this.localPointLights, this.maxPointLights)
      : copyPointLights(lights.pointLights, this.localPointLights, this.maxPointLights)
    this.pointPositions.fill(0)
    this.pointColors.fill(0)
    for (let index = 0; index < localPointLights.length; index += 1) {
      const light = localPointLights[index]
      if (!light) continue
      this.pointPositions.set(light.positionRange, index * 4)
      this.pointColors.set(light.colorDecay, index * 4)
    }
    gl.uniform4fv(program.uniforms.pointPositions, this.pointPositions)
    gl.uniform4fv(program.uniforms.pointColors, this.pointColors)
    gl.uniform1i(program.uniforms.pointCount, localPointLights.length)
    const uniforms = program.uniforms
    const gpu = this.getGeometry(mesh.geometry)
    gl.uniformMatrix4fv(uniforms.model, false, mesh.worldMatrix.elements)
    gl.uniform4f(uniforms.baseColor, surface.color.r, surface.color.g, surface.color.b, surface.color.a)
    gl.uniform3f(uniforms.emissive, ...surface.emissive)
    gl.uniform1i(uniforms.mode, surface.mode)
    gl.uniform1f(uniforms.alphaCutoff, surface.alphaCutoff)
    const alphaCoverage = surface.alphaCutoff > 0 && this.alphaToCoverageActive && !material.transparent
    gl.uniform1i(uniforms.alphaCoverage, alphaCoverage ? 1 : 0)
    gl.uniform1f(uniforms.metallic, surface.metallic)
    gl.uniform1f(uniforms.roughness, surface.roughness)
    gl.uniform1f(uniforms.normalScale, surface.normalScale)
    gl.uniform1f(uniforms.occlusionStrength, surface.occlusionStrength)
    gl.uniform4f(uniforms.textureTransform, surface.textureScale[0], surface.textureScale[1], surface.textureOffset[0], surface.textureOffset[1])
    gl.uniform1f(uniforms.textureRotation, surface.textureRotation)
    gl.uniform1i(uniforms.forceOpaqueAlpha, surface.forceOpaqueAlpha ? 1 : 0)
    gl.uniform4f(uniforms.glassParams, surface.transmission, surface.ior, surface.thickness, surface.attenuationDistance)
    gl.uniform3f(uniforms.attenuationColor, surface.attenuationColor.r, surface.attenuationColor.g, surface.attenuationColor.b)
    gl.uniform1i(uniforms.receiveShadow, mesh.receiveShadow ? 1 : 0)
    gl.uniform4f(uniforms.toonParams, ...surface.toonParams)
    gl.uniform4f(uniforms.toonParams2, ...surface.toonParams2)
    gl.uniform3f(uniforms.toonShadowColor, surface.toonShadowColor.r, surface.toonShadowColor.g, surface.toonShadowColor.b)
    gl.uniform3f(uniforms.toonHighlightColor, surface.toonHighlightColor.r, surface.toonHighlightColor.g, surface.toonHighlightColor.b)
    gl.uniform3f(uniforms.toonRimColor, surface.toonRimColor.r, surface.toonRimColor.g, surface.toonRimColor.b)
    gl.uniform3f(uniforms.toonOutlineColor, surface.toonOutlineColor.r, surface.toonOutlineColor.g, surface.toonOutlineColor.b)
    gl.uniform4f(uniforms.mtoonAdvanced,surface.faceShadowStrength,surface.faceShadowFlipX?1:0,surface.outlineWidth,surface.hairAlphaDither?1:0)
    gl.uniform4f(uniforms.mtoonAdvanced2,surface.mtoonAdvanced2[0],surface.mtoonAdvanced2[1],surface.mtoonAdvanced2[2],surface.mtoonAdvanced2[3])
    gl.uniform4f(uniforms.toonParams3,...surface.toonParams3)
    gl.uniform4f(uniforms.pbrAdvanced,surface.clearcoat,surface.clearcoatRoughness,surface.specularFactor,surface.alphaDither?-surface.sheenIntensity:surface.sheenIntensity)
    gl.uniform3f(uniforms.specularColor,surface.specularColor.r,surface.specularColor.g,surface.specularColor.b)
    gl.uniform4f(uniforms.sheenColor,surface.sheenColor.r,surface.sheenColor.g,surface.sheenColor.b,surface.sheenRoughness)
    gl.uniform4f(uniforms.waterParams,surface.waterParams[0],surface.waterParams[1],surface.waterParams[2],surface.lightMapIntensity)
    gl.uniform4f(uniforms.waterMotion,...surface.waterMotion)
    gl.uniform4f(uniforms.waterFlowTime,surface.waterFlow[0],surface.waterFlow[1],this.waterTimeSeconds,0)
    gl.uniform4f(uniforms.detailParams,surface.detailScale,surface.detailNormalStrength,surface.detailRoughnessStrength,surface.detailHeightScale)
    const surfaceDetailLevel=this.imageQuality.surfaceDetail==='off'?0:this.imageQuality.surfaceDetail==='high'?2:1
    gl.uniform4f(uniforms.surfaceDetailParams,surfaceDetailLevel,surfaceDetailLevel===0?0:surfaceDetailLevel===2?0.4:0.25,0,0)
    gl.uniform3f(uniforms.waterShallowColor,surface.waterShallowColor.r,surface.waterShallowColor.g,surface.waterShallowColor.b)
    gl.uniform3f(uniforms.waterDeepColor,surface.waterDeepColor.r,surface.waterDeepColor.g,surface.waterDeepColor.b)
    gl.uniform3f(uniforms.waterFoamColor,surface.waterFoamColor.r,surface.waterFoamColor.g,surface.waterFoamColor.b)
    this.bindSurfaceTexture(0, surface.baseColor, uniforms.useBaseColorMap, uniforms.baseColorTexCoord)
    this.bindSurfaceTexture(1, surface.metallicRoughness, uniforms.useMetallicRoughnessMap, uniforms.metallicRoughnessTexCoord)
    this.bindSurfaceTexture(2, surface.normal, uniforms.useNormalMap, uniforms.normalTexCoord)
    this.bindSurfaceTexture(3, surface.emissiveTexture, uniforms.useEmissiveMap, uniforms.emissiveTexCoord)
    this.bindSurfaceTexture(4, surface.occlusion, uniforms.useOcclusionMap, uniforms.occlusionTexCoord)
    this.bindSurfaceTexture(5, surface.metallicTexture, uniforms.useMetallicMap, uniforms.metallicTexCoord)
    this.bindSurfaceTexture(6, surface.roughnessTexture, uniforms.useRoughnessMap, uniforms.roughnessTexCoord)
    this.bindSurfaceTexture(8, surface.faceShadow, uniforms.useFaceShadowMap, uniforms.faceShadowTexCoord)
    this.bindSurfaceTexture(10, surface.lightMap, uniforms.useLightMap, uniforms.lightMapTexCoord)
    this.bindSurfaceTexture(13, surface.detailNormal, uniforms.useDetailNormalMap, null)
    this.bindSurfaceTexture(14, surface.detailRoughness, uniforms.useDetailRoughnessMap, null)
    this.bindSurfaceTexture(15, surface.detailHeight, uniforms.useDetailHeightMap, null)
    this.reportUnsupportedMaterial(mesh, material)
    if (material.side === 'double') gl.disable(gl.CULL_FACE)
    else { gl.enable(gl.CULL_FACE); gl.cullFace(material.side === 'back' ? gl.FRONT : gl.BACK) }
    if (material.transparent) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) } else gl.disable(gl.BLEND)
    if (alphaCoverage) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); else gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE)
    gl.depthMask(material.depthWrite)
    gl.bindVertexArray(gpu.vao)
    if (mesh instanceof InstancedMesh) {
      this.bindInstances(mesh)
      this.drawGeometryRange(gpu, item.start, item.count, mesh.drawCount)
      this.stats.triangles += (item.count / 3) * mesh.drawCount
      this.stats.instancedDrawCalls += 1
      this.stats.instancesRendered += mesh.drawCount
    } else {
      this.drawGeometryRange(gpu, item.start, item.count, 1)
      this.stats.triangles += item.count / 3
    }
    this.stats.drawCalls += 1
    this.stats.visibleObjects += 1
    this.stats.materialChanges += 1
    this.stats.uniformUpdates += 1
  }

  private drawShaderMesh(item: RenderItem, camera: Camera, material: ShaderMaterial): void {
    const mesh = item.mesh
    const gl = this.gl as WebGL2RenderingContext
    if (mesh instanceof InstancedMesh) {
      this.reportOnce(`SHADER_INSTANCING:${material.label ?? mesh.id}`, {
        severity: 'warning',
        code: 'SEKAI64_SHADER_MATERIAL_INSTANCING_UNSUPPORTED',
        message: 'ShaderMaterial is not rendered on InstancedMesh yet. Use a regular Mesh or a standard material.',
        details: { backend: this.backend, meshId: mesh.id, material: material.label },
      })
      return
    }
    const source = material.glsl
    if (!source) {
      this.reportOnce(`SHADER_SOURCE:${material.label ?? mesh.id}`, {
        severity: 'warning',
        code: 'SEKAI64_SHADER_MATERIAL_GLSL_REQUIRED',
        message: 'ShaderMaterial requires GLSL source for the WebGL2 backend.',
        details: { backend: this.backend, meshId: mesh.id, material: material.label },
      })
      return
    }
    const program = this.getShaderProgram(source.vertex, source.fragment)
    if (this.activeProgram !== program.program) {
      gl.useProgram(program.program)
      this.activeProgram = program.program
      this.stats.pipelineChanges += 1
    }
    const gpu = this.getGeometry(mesh.geometry)
    gl.uniformMatrix4fv(program.uniforms.model, false, mesh.worldMatrix.elements)
    gl.uniformMatrix4fv(program.uniforms.viewProjection, false, camera.viewProjectionMatrix.elements)
    gl.uniform3f(program.uniforms.cameraPosition, this.lightReference.x, this.lightReference.y, this.lightReference.z)
    gl.uniform4f(program.uniforms.viewport, this.width, this.height, this.pixelRatio, 0)
    packShaderUniforms(material.uniforms.values(), this.shaderUniformValues)
    gl.uniform4fv(program.uniforms.custom, this.shaderUniformValues)
    if (material.side === 'double') gl.disable(gl.CULL_FACE)
    else { gl.enable(gl.CULL_FACE); gl.cullFace(material.side === 'back' ? gl.FRONT : gl.BACK) }
    if (material.transparent) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) } else gl.disable(gl.BLEND)
    gl.depthMask(material.depthWrite)
    gl.bindVertexArray(gpu.vao)
    this.drawGeometryRange(gpu, item.start, item.count, 1)
    this.stats.triangles += item.count / 3
    this.stats.drawCalls += 1
    this.stats.visibleObjects += 1
  }

  private drawGeometryRange(gpu: WebGLGeometry, start: number, count: number, instanceCount: number): void {
    if (instanceCount <= 0) return
    const gl = this.gl as WebGL2RenderingContext
    if (gpu.indexed) {
      const offset = start * (gpu.indexType === gl.UNSIGNED_INT ? 4 : 2)
      if (instanceCount > 1) gl.drawElementsInstanced(gl.TRIANGLES, count, gpu.indexType, offset, instanceCount)
      else gl.drawElements(gl.TRIANGLES, count, gpu.indexType, offset)
    } else if (instanceCount > 1) gl.drawArraysInstanced(gl.TRIANGLES, start, count, instanceCount)
    else gl.drawArrays(gl.TRIANGLES, start, count)
  }

  private bindSurfaceTexture(unit: number, binding: TextureBinding, useLocation: WebGLUniformLocation | null, texCoordLocation: WebGLUniformLocation | null): void {
    const gl = this.gl as WebGL2RenderingContext
    const ready = binding.texture?.ready ?? false
    const state = ready ? this.getTexture(binding.texture as Texture) : this.whiteTexture as WebGLTextureState
    gl.uniform1i(useLocation, ready ? 1 : 0)
    gl.uniform1i(texCoordLocation, binding.texCoord)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, state.texture)
    this.stats.bindGroupChanges += 1
  }

  private bindInstances(mesh: InstancedMesh): void {
    const gl = this.gl as WebGL2RenderingContext
    let state = this.instances.get(mesh)
    if (!state) {
      const matrixBuffer = gl.createBuffer()
      const colorBuffer = gl.createBuffer()
      if (!matrixBuffer || !colorBuffer) { if (matrixBuffer) gl.deleteBuffer(matrixBuffer); if (colorBuffer) gl.deleteBuffer(colorBuffer); throw new Error('WebGL2 failed to allocate instance buffers.') }
      state = { matrixBuffer, colorBuffer, matrixVersion: -1, colorVersion: -1, bytes: mesh.instanceMatrices.byteLength + mesh.instanceColors.byteLength }
      this.instances.set(mesh, state)
      this.stats.geometryMemory += state.bytes
      this.stats.geometryUploads += 2
      this.stats.gpuResourceCreations += 2
      this.stats.gpuResourceCreationsThisFrame += 2
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, state.matrixBuffer)
    if (state.matrixVersion !== mesh.instanceVersion) {
      if (state.matrixVersion < 0) gl.bufferData(gl.ARRAY_BUFFER, mesh.instanceMatrices, gl.DYNAMIC_DRAW)
      else gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.instanceMatrices)
      state.matrixVersion = mesh.instanceVersion
      this.stats.uniformUpdates += 1
    }
    for (let column = 0; column < 4; column += 1) {
      const location = 3 + column
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 64, column * 16)
      gl.vertexAttribDivisor(location, 1)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer)
    if (state.colorVersion !== mesh.instanceColorVersion) {
      if (state.colorVersion < 0) gl.bufferData(gl.ARRAY_BUFFER, mesh.instanceColors, gl.DYNAMIC_DRAW)
      else gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.instanceColors)
      state.colorVersion = mesh.instanceColorVersion
      this.stats.uniformUpdates += 1
    }
    gl.enableVertexAttribArray(10)
    gl.vertexAttribPointer(10, 4, gl.FLOAT, false, 16, 0)
    gl.vertexAttribDivisor(10, 1)
  }

  private createPrograms(): void {
    const gl = this.gl as WebGL2RenderingContext
    this.regular = createProgramState(gl, regularVertex, fragmentSource)
    this.instanced = createProgramState(gl, instancedVertex, fragmentSource)
    this.depthRegular = createDepthProgramState(gl, depthVertex, depthFragment)
    this.depthInstanced = createDepthProgramState(gl, instancedDepthVertex, depthFragment)
    this.outlineRegular = createOutlineProgramState(gl, outlineVertex, outlineFragment)
    this.outlineInstanced = createOutlineProgramState(gl, instancedOutlineVertex, outlineFragment)
    this.pointFieldProgram = createPointFieldProgramState(gl)
    this.shaderPrograms.clear()
    this.stats.shaderCompilations += 7
    this.stats.gpuResourceCreations += 7
  }

  private getShaderProgram(vertex: string, fragment: string): ShaderProgramState {
    const key = `${vertex}\u0000${fragment}`
    const cached = this.shaderPrograms.get(key)
    if (cached) { this.stats.pipelineCacheHits += 1; return cached }
    const gl = this.gl as WebGL2RenderingContext
    const program = createProgram(gl, vertex, fragment)
    const uniform = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name)
    const state: ShaderProgramState = {
      program,
      uniforms: {
        model: uniform('u_model'),
        viewProjection: uniform('u_viewProjection'),
        cameraPosition: uniform('u_cameraPosition'),
        viewport: uniform('u_viewport'),
        custom: uniform('u_custom[0]'),
      },
    }
    this.shaderPrograms.set(key, state)
    this.stats.pipelineCacheMisses += 1
    this.stats.shaderCompilations += 1
    this.stats.gpuResourceCreations += 1
    this.stats.gpuResourceCreationsThisFrame += 1
    return state
  }

  private getGeometry(geometry: Geometry): WebGLGeometry {
    const cached = this.geometries.get(geometry)
    const gl = this.gl as WebGL2RenderingContext
    if (cached?.version === geometry.version) { this.geometryResidency.touch(geometry, cached.bytes, this.frameIndex, () => this.evictGeometry(geometry, cached)); this.stats.geometryCacheHits += 1; return cached }
    this.stats.geometryCacheMisses += 1
    if (cached) {
      gl.deleteVertexArray(cached.vao)
      gl.deleteBuffer(cached.positionBuffer)
      gl.deleteBuffer(cached.normalBuffer)
      gl.deleteBuffer(cached.uvBuffer)
      gl.deleteBuffer(cached.uv1Buffer)
      gl.deleteBuffer(cached.colorBuffer)
      gl.deleteBuffer(cached.tangentBuffer)
      if (cached.indexBuffer) gl.deleteBuffer(cached.indexBuffer)
      this.geometries.delete(geometry)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - cached.bytes)
    }
    const vao = gl.createVertexArray()
    const positionBuffer = gl.createBuffer()
    const normalBuffer = gl.createBuffer()
    const uvBuffer = gl.createBuffer()
    const uv1Buffer = gl.createBuffer()
    const colorBuffer = gl.createBuffer()
    const tangentBuffer = gl.createBuffer()
    if (!vao || !positionBuffer || !normalBuffer || !uvBuffer || !uv1Buffer || !colorBuffer || !tangentBuffer) throw new Error('WebGL2 failed to allocate geometry buffers.')
    const vertexCount = geometry.positions.length / 3
    const normals = geometry.normals ?? new Float32Array(geometry.positions.length)
    const uvs = geometry.uvs ?? new Float32Array(vertexCount * 2)
    const uvs1 = geometry.uvs1 ?? new Float32Array(vertexCount * 2)
    const colors = geometry.colors ?? createDefaultColors(vertexCount)
    const tangents = geometry.tangents ?? new Float32Array(vertexCount * 4)
    gl.bindVertexArray(vao)
    bindAttribute(gl, positionBuffer, geometry.positions, 0, 3)
    bindAttribute(gl, normalBuffer, normals, 1, 3)
    bindAttribute(gl, uvBuffer, uvs, 2, 2)
    bindAttribute(gl, uv1Buffer, uvs1, 7, 2)
    bindAttribute(gl, colorBuffer, colors, 8, 4)
    bindAttribute(gl, tangentBuffer, tangents, 9, 4)
    let indexBuffer: WebGLBuffer | undefined
    let indexType: number = gl.UNSIGNED_SHORT
    if (geometry.indices) {
      indexBuffer = gl.createBuffer() ?? undefined
      if (!indexBuffer) throw new Error('WebGL2 failed to allocate an index buffer.')
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW)
      indexType = geometry.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    }
    gl.bindVertexArray(null)
    const bytes = geometry.positions.byteLength + normals.byteLength + uvs.byteLength + uvs1.byteLength + colors.byteLength + tangents.byteLength + (geometry.indices?.byteLength ?? 0)
    const gpu: WebGLGeometry = { vao, positionBuffer, normalBuffer, uvBuffer, uv1Buffer, colorBuffer, tangentBuffer, version: geometry.version, count: geometry.indices?.length ?? vertexCount, indexed: Boolean(geometry.indices), indexType, bytes, ...(indexBuffer ? { indexBuffer } : {}) }
    this.geometries.set(geometry, gpu)
    this.stats.geometryMemory += bytes
    this.stats.geometryUploads += 1
    this.stats.gpuResourceCreations += 7 + (indexBuffer ? 1 : 0)
    this.stats.gpuResourceCreationsThisFrame += 7 + (indexBuffer ? 1 : 0)
    this.geometryResidency.touch(geometry, bytes, this.frameIndex, () => this.evictGeometry(geometry, gpu))
    return gpu
  }

  private getTexture(texture: Texture): WebGLTextureState {
    const cached = this.textures.get(texture)
    if (cached?.version === texture.version) {
      cached.lastUsedFrame = this.frameIndex
      this.textureResidency.touch(texture, cached.bytes, this.frameIndex, () => this.evictTexture(texture, cached))
      return cached
    }
    const gl = this.gl as WebGL2RenderingContext
    if (!texture.image && !texture.dataSource) return this.whiteTexture as WebGLTextureState
    if (texture.width > this.capabilities.maxTextureSize || texture.height > this.capabilities.maxTextureSize) throw new Error(`Texture ${texture.width}×${texture.height} exceeds WebGL2 maxTextureSize ${this.capabilities.maxTextureSize}.`)
    const handle = cached?.texture ?? gl.createTexture()
    if (!handle) throw new Error('WebGL2 failed to allocate a texture.')
    if (cached) this.stats.textureMemory = Math.max(0, this.stats.textureMemory - cached.bytes)
    gl.bindTexture(gl.TEXTURE_2D, handle)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY ? 1 : 0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    const canSubUpload = cached !== undefined
      && cached.width === texture.width
      && cached.height === texture.height
      && cached.colorSpace === texture.colorSpace
    const internalFormat = texture.colorSpace === 'srgb' || texture.dataSource?.format === 'rgba8unorm-srgb' ? gl.SRGB8_ALPHA8 : gl.RGBA8
    if (texture.dataSource) {
      const source = texture.dataSource
      if (canSubUpload) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, source.width, source.height, gl.RGBA, gl.UNSIGNED_BYTE, source.data)
      else gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data)
      let mipIndex = 1
      for (const level of source.mipLevels ?? []) {
        if (level.width === source.width && level.height === source.height) continue
        gl.texImage2D(gl.TEXTURE_2D, mipIndex++, internalFormat, level.width, level.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, level.data)
      }
    } else if (texture.image) {
      if (canSubUpload) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
      else gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, toFilter(gl, texture.minFilter, texture.generateMipmaps))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.magFilter === 'nearest' ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, toWrap(gl, texture.wrapS))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, toWrap(gl, texture.wrapT))
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic') as { TEXTURE_MAX_ANISOTROPY_EXT: number; MAX_TEXTURE_MAX_ANISOTROPY_EXT: number } | null
    if (anisotropy && texture.magFilter === 'linear') {
      const supported = Number(gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) ?? 1)
      gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(supported, this.imageQuality.maxAnisotropy))
    }
    if (texture.generateMipmaps && !(texture.dataSource?.mipLevels?.length)) gl.generateMipmap(gl.TEXTURE_2D)
    const state: WebGLTextureState = {
      texture: handle,
      version: texture.version,
      bytes: texture.estimatedBytes,
      width: texture.width,
      height: texture.height,
      colorSpace: texture.colorSpace,
      lastUsedFrame: this.frameIndex,
    }
    this.textures.set(texture, state)
    this.stats.textureMemory += state.bytes
    this.stats.textureUploads += 1
    if (!cached) { this.stats.gpuResourceCreations += 1; this.stats.gpuResourceCreationsThisFrame += 1 }
    this.textureResidency.touch(texture, state.bytes, this.frameIndex, () => this.evictTexture(texture, state))
    return state
  }

  private collectDisposedResources(): void {
    const gl = this.gl as WebGL2RenderingContext
    for (const [geometry, gpu] of this.geometries) if (geometry.disposed) {
      this.deleteGeometry(gl, gpu)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - gpu.bytes)
      this.geometries.delete(geometry)
      this.geometryResidency.remove(geometry)
    }
    for (const [mesh, state] of this.instances) if (mesh.disposed) {
      gl.deleteBuffer(state.matrixBuffer)
      gl.deleteBuffer(state.colorBuffer)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - state.bytes)
      this.instances.delete(mesh)
    }
    for (const [field, state] of this.pointFields) if (field.disposed) {
      gl.deleteVertexArray(state.vao)
      gl.deleteBuffer(state.positionBuffer)
      gl.deleteBuffer(state.colorBuffer)
      gl.deleteBuffer(state.appearanceBuffer)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - state.bytes)
      this.pointFields.delete(field)
    }
    for (const [texture, state] of this.textures) if (texture.disposed) {
      gl.deleteTexture(state.texture)
      this.stats.textureMemory = Math.max(0, this.stats.textureMemory - state.bytes)
      this.textures.delete(texture)
      this.textureResidency.remove(texture)
    }
  }

  private evictGeometry(geometry: Geometry, gpu: WebGLGeometry): void {
    if (this.geometries.get(geometry) !== gpu || !this.gl) return
    this.deleteGeometry(this.gl, gpu)
    this.geometries.delete(geometry)
    this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - gpu.bytes)
  }

  private deleteGeometry(gl: WebGL2RenderingContext, gpu: WebGLGeometry): void {
    gl.deleteVertexArray(gpu.vao)
    gl.deleteBuffer(gpu.positionBuffer)
    gl.deleteBuffer(gpu.normalBuffer)
    gl.deleteBuffer(gpu.uvBuffer)
    gl.deleteBuffer(gpu.uv1Buffer)
    gl.deleteBuffer(gpu.colorBuffer)
    gl.deleteBuffer(gpu.tangentBuffer)
    if (gpu.indexBuffer) gl.deleteBuffer(gpu.indexBuffer)
  }

  private reportLightLimits(lights: SceneLightSummary): void {
    if (lights.pointCount > lights.selectedPointCount) this.reportOnce('POINT_LIGHT_LIMIT', {
      severity: 'warning',
      code: 'SEKAI64_POINT_LIGHT_LIMIT',
      message: `Sekai64 selected ${lights.selectedPointCount} of ${lights.pointCount} visible point lights for this frame.`,
      details: { backend: this.backend, visible: lights.pointCount, selected: lights.selectedPointCount, maximum: this.maxPointLights }
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

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.contextLost = true
    this.diagnostics?.({
      severity: 'error',
      code: 'SEKAI64_WEBGL_CONTEXT_LOST',
      message: 'The WebGL2 rendering context was lost. Rendering is paused until the browser restores it.',
      details: { backend: this.backend },
    })
  }
  private readonly handleContextRestored = (): void => {
    const gl = this.gl
    if (!gl) return
    this.contextLost = false
    this.gpuTimerQueries.length=0
    this.gpuTimerExtension=null
    this.geometries.clear()
    this.instances.clear()
    this.pointFields.clear()
    this.textures.clear()
    this.cloudNoiseTexture = undefined
    this.cloudNoiseSeed = Number.NaN
    this.stats.geometryMemory = 0
    this.stats.textureMemory = 0
    this.shadowFramebuffer = undefined
    this.shadowTexture = undefined
    this.shadowMapSize = 0
    this.shadowCascadeLayers=0
    this.shadowAvailable = false
    this.gpuTimerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as WebGLDisjointTimerQueryExtension | null
    this.createPrograms()
    this.postProcessPipeline = new WebGLPostProcessPipeline(gl)
    this.whiteTexture = createWhiteTexture(gl)
    if(this.environmentMap)this.environmentTexture=this.uploadEnvironmentMap(this.environmentMap)
    if(this.proceduralClouds.enabled)this.ensureCloudNoiseTexture()
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.enable(gl.CULL_FACE)
    this.diagnostics?.({
      severity: 'info',
      code: 'SEKAI64_WEBGL_CONTEXT_RESTORED',
      message: 'The WebGL2 rendering context was restored and GPU resources will be rebuilt lazily.',
      details: { backend: this.backend },
    })
  }
  private assertReady(): void {
    if (this.disposed) throw new Error('WebGL2Renderer is disposed.')
    if (!this.gl || !this.regular || !this.instanced || !this.whiteTexture) throw new Error('WebGL2Renderer is not initialized.')
  }
}

function createOutlineProgramState(gl: WebGL2RenderingContext, vertex: string, fragment: string): OutlineProgramState {
  const program = createProgram(gl, vertex, fragment)
  return { program, uniforms: { model: gl.getUniformLocation(program, 'u_model'), viewProjection: gl.getUniformLocation(program, 'u_viewProjection'), width: gl.getUniformLocation(program, 'u_outlineWidth'), mode: gl.getUniformLocation(program, 'u_outlineMode'), color: gl.getUniformLocation(program, 'u_outlineColor') } }
}
function createDepthProgramState(gl: WebGL2RenderingContext, vertex: string, fragment: string): DepthProgramState {
  const program = createProgram(gl, vertex, fragment)
  const uniforms: DepthUniforms = {
    model: gl.getUniformLocation(program, 'u_model'),
    lightViewProjection: gl.getUniformLocation(program, 'u_lightViewProjection'),
    baseColor: gl.getUniformLocation(program, 'u_baseColor'),
    alphaCutoff: gl.getUniformLocation(program, 'u_alphaCutoff'),
    baseColorMap: gl.getUniformLocation(program, 'u_baseColorMap'),
    useBaseColorMap: gl.getUniformLocation(program, 'u_useBaseColorMap'),
    baseColorTexCoord: gl.getUniformLocation(program, 'u_baseColorTexCoord'),
    textureTransform: gl.getUniformLocation(program, 'u_textureTransform'),
    textureRotation: gl.getUniformLocation(program, 'u_textureRotation'),
  }
  gl.useProgram(program)
  gl.uniform1i(uniforms.baseColorMap, 0)
  return { program, uniforms }
}
function createPointFieldProgramState(gl: WebGL2RenderingContext): PointFieldProgramState {
  const program = createProgram(gl, pointFieldVertex, pointFieldFragment)
  return {
    program,
    model: gl.getUniformLocation(program, 'u_model'),
    viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
    viewport: gl.getUniformLocation(program, 'u_viewport'),
    directional: gl.getUniformLocation(program, 'u_directional'),
    outputParams: gl.getUniformLocation(program, 'u_outputParams'),
  }
}

function createEnvironmentBackgroundProgramState(gl: WebGL2RenderingContext): EnvironmentBackgroundProgramState {
  const program = createProgram(gl, environmentBackgroundVertex, environmentBackgroundFragment)
  return {
    program,
    inverseViewProjection: gl.getUniformLocation(program, 'u_inverseViewProjection'),
    cameraPosition: gl.getUniformLocation(program, 'u_cameraPosition'),
    environmentMap: gl.getUniformLocation(program, 'u_environmentMap'),
    cloudNoiseMap: gl.getUniformLocation(program, 'u_cloudNoiseMap'),
    params: gl.getUniformLocation(program, 'u_params'),
    outputParams: gl.getUniformLocation(program, 'u_outputParams'),
    cloudParams: gl.getUniformLocation(program, 'u_cloudParams'),
    cloudMotion: gl.getUniformLocation(program, 'u_cloudMotion'),
    cloudSun: gl.getUniformLocation(program, 'u_cloudSun'),
    cloudShape: gl.getUniformLocation(program, 'u_cloudShape'),
    cloudHorizon: gl.getUniformLocation(program, 'u_cloudHorizon'),
    cloudLighting: gl.getUniformLocation(program, 'u_cloudLighting'),
    cloudDetailMotion: gl.getUniformLocation(program, 'u_cloudDetailMotion'),
    cloudAmbientColor: gl.getUniformLocation(program, 'u_cloudAmbientColor'),
    cloudShadowColor: gl.getUniformLocation(program, 'u_cloudShadowColor'),
    cloudLightColor: gl.getUniformLocation(program, 'u_cloudLightColor'),
  }
}

function createProgramState(gl: WebGL2RenderingContext, vertex: string, fragment: string): ProgramState {
  const program = createProgram(gl, vertex, fragment)
  const uniform = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name)
  return { program, uniforms: {
    model: uniform('u_model'),
    viewProjection: uniform('u_viewProjection'),
    cameraPosition: uniform('u_cameraPosition'),
    baseColor: uniform('u_baseColor'),
    emissive: uniform('u_emissive'),
    ambient: uniform('u_ambient'),
    directionalColor: uniform('u_directionalColor'),
    directionalDirection: uniform('u_directionalDirection'),
    pointPositions: uniform('u_pointPositions[0]'),
    pointColors: uniform('u_pointColors[0]'),
    pointCount: uniform('u_pointCount'),
    spotPositions: uniform('u_spotPositions[0]'),
    spotDirections: uniform('u_spotDirections[0]'),
    spotColors: uniform('u_spotColors[0]'),
    spotCount: uniform('u_spotCount'),
    mode: uniform('u_mode'),
    alphaCutoff: uniform('u_alphaCutoff'),
    alphaCoverage: uniform('u_alphaCoverage'),
    metallic: uniform('u_metallic'),
    roughness: uniform('u_roughness'),
    normalScale: uniform('u_normalScale'),
    occlusionStrength: uniform('u_occlusionStrength'),
    textureTransform: uniform('u_textureTransform'),
    textureRotation: uniform('u_textureRotation'),
    forceOpaqueAlpha: uniform('u_forceOpaqueAlpha'),
    baseColorMap: uniform('u_baseColorMap'),
    metallicRoughnessMap: uniform('u_metallicRoughnessMap'),
    normalMap: uniform('u_normalMap'),
    emissiveMap: uniform('u_emissiveMap'),
    occlusionMap: uniform('u_occlusionMap'),
    useBaseColorMap: uniform('u_useBaseColorMap'),
    useMetallicRoughnessMap: uniform('u_useMetallicRoughnessMap'),
    useNormalMap: uniform('u_useNormalMap'),
    useEmissiveMap: uniform('u_useEmissiveMap'),
    useOcclusionMap: uniform('u_useOcclusionMap'),
    baseColorTexCoord: uniform('u_baseColorTexCoord'),
    metallicRoughnessTexCoord: uniform('u_metallicRoughnessTexCoord'),
    normalTexCoord: uniform('u_normalTexCoord'),
    emissiveTexCoord: uniform('u_emissiveTexCoord'),
    occlusionTexCoord: uniform('u_occlusionTexCoord'),
    metallicMap: uniform('u_metallicMap'),
    roughnessMap: uniform('u_roughnessMap'),
    useMetallicMap: uniform('u_useMetallicMap'),
    useRoughnessMap: uniform('u_useRoughnessMap'),
    metallicTexCoord: uniform('u_metallicTexCoord'),
    roughnessTexCoord: uniform('u_roughnessTexCoord'),
    detailNormalMap: uniform('u_detailNormalMap'),
    detailRoughnessMap: uniform('u_detailRoughnessMap'),
    detailHeightMap: uniform('u_detailHeightMap'),
    useDetailNormalMap: uniform('u_useDetailNormalMap'),
    useDetailRoughnessMap: uniform('u_useDetailRoughnessMap'),
    useDetailHeightMap: uniform('u_useDetailHeightMap'),
    detailParams: uniform('u_detailParams'),
    surfaceDetailParams: uniform('u_surfaceDetailParams'),
    outputParams: uniform('u_outputParams'),
    environmentSky: uniform('u_environmentSky'),
    environmentGround: uniform('u_environmentGround'),
    environmentParams: uniform('u_environmentParams'),
    glassParams: uniform('u_glassParams'),
    attenuationColor: uniform('u_attenuationColor'),
    shadowMatrix: uniform('u_shadowMatrix'),
    shadowMatrices: uniform('u_shadowMatrices[0]'),
    shadowSplits: uniform('u_shadowSplits'),
    shadowCascadeParams: uniform('u_shadowCascadeParams'),
    shadowMap: uniform('u_shadowMap'),
    shadowParams: uniform('u_shadowParams'),
    shadowQuality: uniform('u_shadowQuality'),
    receiveShadow: uniform('u_receiveShadow'),
    toonParams: uniform('u_toonParams'),
    toonParams2: uniform('u_toonParams2'),
    toonShadowColor: uniform('u_toonShadowColor'),
    toonHighlightColor: uniform('u_toonHighlightColor'),
    toonRimColor: uniform('u_toonRimColor'),
    toonOutlineColor: uniform('u_toonOutlineColor'),
    atmosphereColor: uniform('u_atmosphereColor'),
    atmosphereParams: uniform('u_atmosphereParams'),
    atmosphereParams2: uniform('u_atmosphereParams2'),
    gradingParams: uniform('u_gradingParams'),
    gradingParams2: uniform('u_gradingParams2'),
    gradingParams3: uniform('u_gradingParams3'),
    viewportSize: uniform('u_viewportSize'),
    faceShadowMap: uniform('u_faceShadowMap'),
    useFaceShadowMap: uniform('u_useFaceShadowMap'),
    faceShadowTexCoord: uniform('u_faceShadowTexCoord'),
    mtoonAdvanced: uniform('u_mtoonAdvanced'),
    environmentMap: uniform('u_environmentMap'),
    environmentDiffuseMap: uniform('u_environmentDiffuseMap'),
    environmentBrdfLut: uniform('u_environmentBrdfLut'),
    environmentMapParams: uniform('u_environmentMapParams'),
    environmentIblParams: uniform('u_environmentIblParams'),
    lightMap: uniform('u_lightMap'),
    useLightMap: uniform('u_useLightMap'),
    lightMapTexCoord: uniform('u_lightMapTexCoord'),
    pbrAdvanced: uniform('u_pbrAdvanced'),
    specularColor: uniform('u_specularColor'),
    sheenColor: uniform('u_sheenColor'),
    waterParams: uniform('u_waterParams'),
    waterMotion: uniform('u_waterMotion'),
    waterFlowTime: uniform('u_waterFlowTime'),
    waterShallowColor: uniform('u_waterShallowColor'),
    waterDeepColor: uniform('u_waterDeepColor'),
    waterFoamColor: uniform('u_waterFoamColor'),
    toonParams3: uniform('u_toonParams3'),
    mtoonAdvanced2: uniform('u_mtoonAdvanced2')
  } }
}
function packShaderUniforms(values: Iterable<UniformValue>, target: Float32Array): void {
  target.fill(0)
  let slot = 0
  for (const value of values) {
    if (slot >= 16) break
    const offset = slot * 4
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
function emptyBinding(texture?: Texture, texCoord: 0 | 1 = 0): TextureBinding { return { texture, texCoord } }
function defaultToonSurface(){return { detailNormal:emptyBinding(),detailRoughness:emptyBinding(),detailHeight:emptyBinding(),detailScale:1,detailNormalStrength:0,detailRoughnessStrength:0,detailHeightScale:0,textureScale:[1,1] as const,textureOffset:[0,0] as const,textureRotation:0,toonParams:[3,0.58,0.2,0.18] as const,toonParams2:[2.5,0.68,5,0] as const,toonParams3:[0.08,0,0.18,0] as const,mtoonAdvanced2:[0.12,0.08,0,0] as const,toonShadowColor:Color.from('#66708f'),toonHighlightColor:Color.from('#fff4df'),toonRimColor:Color.from('#ffd7e8'),toonOutlineColor:Color.from('#201a2a'),faceShadow:emptyBinding(),faceShadowStrength:0,faceShadowFlipX:false,hairAlphaDither:false,outlineWidth:0,lightMap:emptyBinding(),lightMapIntensity:1,specularFactor:1,specularColor:Color.from('#ffffff'),clearcoat:0,clearcoatRoughness:0.1,sheenColor:Color.from('#ffffff'),sheenIntensity:0,sheenRoughness:0.5,alphaDither:false,waterParams:[5,0.78,1,1] as const,waterMotion:[0.45,0,0.35,0.18] as const,waterFlow:[0.9438583563660174,0.33035042472810605] as const,waterShallowColor:Color.from('#55b8d6'),waterDeepColor:Color.from('#0a3f67'),waterFoamColor:Color.from('#e8fbff') }}
function materialSurface(material: Material): MaterialSurface | null {
  if (material instanceof StandardMaterial) return {
    color: material.baseColor,
    emissive: [material.emissive.r * material.emissiveIntensity, material.emissive.g * material.emissiveIntensity, material.emissive.b * material.emissiveIntensity],
    mode: material.shadingModel === 'toon' ? 4 : material.shadingModel === 'mtoon' ? 5 : material.shadingModel === 'water' ? 6 : 1,
    alphaCutoff: material.alphaMode === 'mask' ? material.alphaCutoff : 0,
    metallic: material.metallic,
    roughness: material.roughness,
    normalScale: material.normalScale,
    occlusionStrength: material.occlusionStrength,
    textureScale: material.textureScale,
    textureOffset: material.textureOffset,
    textureRotation: material.textureRotation,
    forceOpaqueAlpha: material.alphaMode !== 'blend',
    baseColor: emptyBinding(material.baseColorTexture, material.baseColorTexCoord),
    metallicRoughness: emptyBinding(material.metallicRoughnessTexture, material.metallicRoughnessTexCoord),
    normal: emptyBinding(material.normalTexture, material.normalTexCoord),
    emissiveTexture: emptyBinding(material.emissiveTexture, material.emissiveTexCoord),
    occlusion: emptyBinding(material.occlusionTexture, material.occlusionTexCoord),
    metallicTexture: material.shadingModel === 'mtoon' ? emptyBinding(material.mtoonShadeTexture, material.mtoonShadeTexCoord) : emptyBinding(material.metallicTexture, material.metallicTexCoord),
    roughnessTexture: material.shadingModel === 'mtoon' ? emptyBinding(material.mtoonMatcapTexture, material.mtoonMatcapTexCoord) : emptyBinding(material.roughnessTexture, material.roughnessTexCoord),
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
    attenuationDistance: material.attenuationDistance,
    attenuationColor: material.attenuationColor,
    toonParams: material.shadingModel === 'mtoon'
      ? [material.characterHairSpecularPower, material.mtoonShadingToony, 0, material.mtoonRimLightingMix]
      : [material.toonShadeSteps, material.toonShadowStrength, material.toonHighlightStrength, material.toonRimStrength],
    toonParams2: material.shadingModel === 'mtoon'
      ? [material.mtoonRimFresnelPower, 0, 0, material.mtoonShadingShift]
      : [material.toonRimPower, material.toonOutlineStrength, material.toonOutlinePower, 0],
    toonShadowColor: material.shadingModel === 'mtoon' ? material.mtoonShadeColor : material.toonShadowColor,
    toonHighlightColor: material.shadingModel === 'mtoon' ? material.mtoonMatcapColor : material.toonHighlightColor,
    toonRimColor: material.shadingModel === 'mtoon' ? material.mtoonRimColor : material.toonRimColor,
    toonOutlineColor: material.shadingModel === 'mtoon' ? material.mtoonOutlineColor : material.toonOutlineColor,
    faceShadow: material.shadingModel === 'mtoon' && material.mtoonShadingShiftTexture ? emptyBinding(material.mtoonShadingShiftTexture, material.mtoonShadingShiftTexCoord) : emptyBinding(material.faceShadowTexture, material.faceShadowTexCoord),
    faceShadowStrength: material.mtoonFaceShadowStrength,
    faceShadowFlipX: material.mtoonFaceShadowFlipX,
    hairAlphaDither: material.shadingModel === 'mtoon' && material.mtoonHairAlphaDither,
    outlineWidth: material.mtoonOutlineWidth,
    lightMap: material.shadingModel === 'mtoon' && material.mtoonRimTexture ? emptyBinding(material.mtoonRimTexture, material.mtoonRimTexCoord) : emptyBinding(material.lightMapTexture, material.lightMapTexCoord),
    lightMapIntensity: material.lightMapIntensity,
    specularFactor: material.specularFactor,
    specularColor: material.specularColor,
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
    sheenColor: material.sheenColor,
    sheenIntensity: material.sheenIntensity,
    sheenRoughness: material.sheenRoughness,
    alphaDither: material.alphaDither,
    toonParams3: material.shadingModel === 'mtoon' ? [material.mtoonOcclusionMix,material.characterSoftLighting,material.characterEyeHighlightStrength,material.characterHairSpecularStrength] : [material.toonBandSmoothness,material.toonShadowOffset,material.toonEnvironmentMix,0],
    mtoonAdvanced2: material.shadingModel === 'mtoon' ? [material.mtoonGiEqualization,material.mtoonRimLift,material.mtoonShadingShiftTextureScale,material.mtoonShadingShiftTexture?1:(material.faceShadowTexture?2:0)] : [material.mtoonEnvironmentMix,material.mtoonFaceShadowSoftness,0,0],
    waterParams: [material.waterFresnelPower,material.waterReflectionStrength,material.waterAbsorptionStrength,material.lightMapIntensity],
    waterMotion: [material.waterWaveScale,material.waterWaveStrength,material.waterWaveSpeed,material.waterFoamStrength],
    waterFlow: material.waterFlowDirection,
    waterShallowColor: material.waterShallowColor,
    waterDeepColor: material.waterDeepColor,
    waterFoamColor: material.waterFoamColor
  }
  if (material instanceof TextureMaterial) return { ...defaultToonSurface(), color: material.tint, emissive: [0, 0, 0], mode: 0, alphaCutoff: material.alphaCutoff, metallic: 0, roughness: 1, normalScale: 1, occlusionStrength: 1, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding(material.map), metallicRoughness: emptyBinding(), normal: emptyBinding(), emissiveTexture: emptyBinding(), occlusion: emptyBinding(), metallicTexture: emptyBinding(), roughnessTexture: emptyBinding(), transmission: 0, ior: 1.5, thickness: 0, attenuationDistance: 1, attenuationColor: new Color(1,1,1,1) }
  if (material instanceof BasicMaterial) return { ...defaultToonSurface(), color: material.baseColor, emissive: [0, 0, 0], mode: 0, alphaCutoff: 0, metallic: 0, roughness: 1, normalScale: 1, occlusionStrength: 1, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding(), metallicRoughness: emptyBinding(), normal: emptyBinding(), emissiveTexture: emptyBinding(), occlusion: emptyBinding(), metallicTexture: emptyBinding(), roughnessTexture: emptyBinding(), transmission: 0, ior: 1.5, thickness: 0, attenuationDistance: 1, attenuationColor: new Color(1,1,1,1) }
  if (material instanceof NormalMaterial) return { ...defaultToonSurface(), color: new Color(), emissive: [0, 0, 0], mode: 2, alphaCutoff: 0, metallic: 0, roughness: 1, normalScale: 1, occlusionStrength: 1, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding(), metallicRoughness: emptyBinding(), normal: emptyBinding(), emissiveTexture: emptyBinding(), occlusion: emptyBinding(), metallicTexture: emptyBinding(), roughnessTexture: emptyBinding(), transmission: 0, ior: 1.5, thickness: 0, attenuationDistance: 1, attenuationColor: new Color(1,1,1,1) }
  if (material instanceof DepthMaterial) return { ...defaultToonSurface(), color: new Color(), emissive: [0, 0, 0], mode: 3, alphaCutoff: 0, metallic: 0, roughness: 1, normalScale: 1, occlusionStrength: 1, forceOpaqueAlpha: !material.transparent, baseColor: emptyBinding(), metallicRoughness: emptyBinding(), normal: emptyBinding(), emissiveTexture: emptyBinding(), occlusion: emptyBinding(), metallicTexture: emptyBinding(), roughnessTexture: emptyBinding(), transmission: 0, ior: 1.5, thickness: 0, attenuationDistance: 1, attenuationColor: new Color(1,1,1,1) }
  return null
}
function createWhiteTexture(gl: WebGL2RenderingContext): WebGLTextureState {
  const texture = gl.createTexture()
  if (!texture) throw new Error('WebGL2 failed to allocate the fallback texture.')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return { texture, version: 0, bytes: 4, width: 1, height: 1, colorSpace: 'linear', lastUsedFrame: 0 }
}
function toFilter(gl: WebGL2RenderingContext, filter: Texture['minFilter'], mipmaps: boolean): number {
  if (!mipmaps || filter === 'nearest') return filter === 'nearest' ? gl.NEAREST : gl.LINEAR
  if (filter === 'linear') return gl.LINEAR
  if (filter === 'nearest-mipmap-nearest') return gl.NEAREST_MIPMAP_NEAREST
  if (filter === 'linear-mipmap-nearest') return gl.LINEAR_MIPMAP_NEAREST
  if (filter === 'nearest-mipmap-linear') return gl.NEAREST_MIPMAP_LINEAR
  return gl.LINEAR_MIPMAP_LINEAR
}
function toWrap(gl: WebGL2RenderingContext, wrap: 'clamp-to-edge' | 'repeat' | 'mirror-repeat'): number {
  if (wrap === 'repeat') return gl.REPEAT
  if (wrap === 'mirror-repeat') return gl.MIRRORED_REPEAT
  return gl.CLAMP_TO_EDGE
}
function bindAttribute(gl: WebGL2RenderingContext, buffer: WebGLBuffer, data: Float32Array, location: number, size: number): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
}
function createDefaultColors(vertexCount: number): Float32Array {
  const colors = new Float32Array(vertexCount * 4)
  colors.fill(1)
  return colors
}
function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment)
  const program = gl.createProgram()
  if (!program) throw new Error('WebGL2 failed to create a shader program.')
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown link error.'
    gl.deleteProgram(program)
    throw new Error(`Sekai64 WebGL2 shader link failed:\n${log}`)
  }
  return program
}
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL2 failed to create a shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown compile error.'
    gl.deleteShader(shader)
    throw new Error(`Sekai64 WebGL2 shader compilation failed:\n${log}`)
  }
  return shader
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
function isHtmlCanvas(value: RenderSurface): value is HTMLCanvasElement { return typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement }

function copyPointLights(source: readonly ClusteredPointLight[], target: ClusteredPointLight[], maximum: number): readonly ClusteredPointLight[] {
  target.length = 0
  for (let index = 0; index < Math.min(maximum, source.length); index += 1) {
    const light = source[index]
    if (light) target.push(light)
  }
  return target
}

function now():number{return typeof performance!=='undefined'?performance.now():Date.now()}
function updateFrameStats(stats:RendererStats,started:number,previous:number,scale:number):void{const elapsed=Math.max(0,now()-started);stats.cpuFrameMs=elapsed;stats.renderScale=scale;const interval=previous>0?Math.max(0.001,started-previous):elapsed;stats.fps=interval>0?1000/interval:0}
