import type { Camera } from '@sekai64-internal/cameras'
import type { Geometry } from '@sekai64-internal/geometry'
import { collectSceneLights, type SceneLightSummary } from '@sekai64-internal/lighting'
import { BasicMaterial, DepthMaterial, NormalMaterial, ShaderMaterial, StandardMaterial, Texture, TextureMaterial, type Material, type UniformValue } from '@sekai64-internal/materials'
import { Box3, Color, Frustum, Matrix4, Vector3, type ColorInput } from '@sekai64-internal/math'
import { ClusteredLightGrid, GeometryResidencyManager, RenderQueueBuilder, createDirectionalShadowCascades, createRendererAdvancedCapabilities, createRendererFeatures, createRendererStats, HierarchicalDepthCuller, resolveAtmosphere, resolveColorGrading, resolveColorManagement, resolveEnvironmentLighting, resolveImageQuality, resolveOptimization, resolvePostProcessing, resolveShadowOptions, srgbToLinear, TextureResidencyManager, type RecoverableRenderer, type RendererAtmosphere, type RendererCapabilities, type RendererColorGrading, type RendererColorManagement, type RendererDiagnosticSink, type RendererEnvironmentLighting, type RendererEnvironmentMap, type RendererImageQuality, type RendererOptimizationOptions, type RendererOptions, type RendererPostProcessing, type RendererRecoveryOptions, type RendererShadowOptions, type RendererStats, type RenderSurface, type RenderItem, type ClusteredPointLight } from '@sekai64-internal/renderer'
import { InstancedMesh, type Mesh, type Scene } from '@sekai64-internal/scene'
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
interface WebGLInstances { buffer: WebGLBuffer; version: number; bytes: number }
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
  waterShallowColor: WebGLUniformLocation | null
  waterDeepColor: WebGLUniformLocation | null
  waterFoamColor: WebGLUniformLocation | null
  toonParams3: WebGLUniformLocation | null
  mtoonAdvanced2: WebGLUniformLocation | null
}
interface ProgramState { program: WebGLProgram; uniforms: Uniforms }
interface DepthUniforms { model: WebGLUniformLocation | null; lightViewProjection: WebGLUniformLocation | null }
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
void main(){mat4 instanceMatrix=mat4(a_instance0,a_instance1,a_instance2,a_instance3);mat4 world=u_model*instanceMatrix;mat3 world3=mat3(world);mat3 normalMatrix=transpose(inverse(world3));float handedness=determinant(world3)<0.0?-1.0:1.0;vec4 worldPosition=world*vec4(a_position,1.0);gl_Position=u_viewProjection*worldPosition;v_worldPosition=worldPosition.xyz;v_normal=normalMatrix*a_normal;v_uv=a_uv;v_uv1=a_uv1;v_color=a_color;v_tangent=vec4(world3*a_tangent.xyz,a_tangent.w*handedness);}`
const depthVertex = `#version 300 es
layout(location=0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_lightViewProjection;
void main(){gl_Position=u_lightViewProjection*u_model*vec4(a_position,1.0);}`
const instancedDepthVertex = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=3) in vec4 a_instance0;
layout(location=4) in vec4 a_instance1;
layout(location=5) in vec4 a_instance2;
layout(location=6) in vec4 a_instance3;
uniform mat4 u_model;
uniform mat4 u_lightViewProjection;
void main(){mat4 instanceMatrix=mat4(a_instance0,a_instance1,a_instance2,a_instance3);gl_Position=u_lightViewProjection*u_model*instanceMatrix*vec4(a_position,1.0);}`
const depthFragment = `#version 300 es
precision highp float;
void main(){}`
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
uniform vec4 u_waterParams;uniform vec3 u_waterShallowColor;uniform vec3 u_waterDeepColor;uniform vec3 u_waterFoamColor;uniform vec4 u_toonParams3;uniform vec4 u_mtoonAdvanced2;
uniform vec4 u_textureTransform;uniform float u_textureRotation;
out vec4 outColor;
vec2 uvSet(int index){
  vec2 uv=index==1?v_uv1:v_uv;
  vec2 scaled=uv*u_textureTransform.xy;
  float c=cos(u_textureRotation);float sn=sin(u_textureRotation);
  return vec2(c*scaled.x-sn*scaled.y,sn*scaled.x+c*scaled.y)+u_textureTransform.zw;
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
vec3 surfaceNormal(){
  vec3 n=normalize(v_normal);
  if(!gl_FrontFacing)n=-n;
  if(!u_useNormalMap)return n;
  vec2 uv=uvSet(u_normalTexCoord);
  vec3 mapNormal=texture(u_normalMap,uv).xyz*2.0-1.0;
  mapNormal.xy*=u_normalScale;
  vec3 dp1=dFdx(v_worldPosition);
  vec3 dp2=dFdy(v_worldPosition);
  vec2 duv1=dFdx(uv);
  vec2 duv2=dFdy(uv);
  vec3 t;
  vec3 b;
  if(length(v_tangent.xyz)>0.0001){
    t=normalize(v_tangent.xyz-n*dot(n,v_tangent.xyz));
    b=normalize(cross(n,t))*v_tangent.w;
  }else{
    vec3 dp2perp=cross(dp2,n);
    vec3 dp1perp=cross(n,dp1);
    t=dp2perp*duv1.x+dp1perp*duv2.x;
    b=dp2perp*duv1.y+dp1perp*duv2.y;
    float scale=max(dot(t,t),dot(b,b));
    if(scale>0.0000001){float invmax=inversesqrt(scale);t*=invmax;b*=invmax;}else{t=normalize(vec3(n.z,0.0,-n.x));b=cross(n,t);}
  }
  return normalize(mat3(t,b,n)*mapNormal);
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
  if(u_useBaseColorMap)sampled=texture(u_baseColorMap,uvSet(u_baseColorTexCoord));
  float alpha=tint.a*v_color.a*sampled.a;
  float coverageNoise=interleavedGradientNoise(gl_FragCoord.xy);
  if(u_alphaCutoff>0.0){float edge=max(fwidth(alpha),1.0/255.0);float coverage=smoothstep(u_alphaCutoff-edge,u_alphaCutoff+edge,alpha);if(coverage<coverageNoise)discard;alpha=1.0;}
  else if((u_mtoonAdvanced.w>0.5||u_pbrAdvanced.w<0.0)&&alpha<1.0){if(alpha<coverageNoise)discard;alpha=1.0;}
  float outputAlpha=u_forceOpaqueAlpha?1.0:alpha;
  vec3 base=srgbToLinear(tint.rgb)*v_color.rgb*sampled.rgb;
  vec3 color=base;
  if(u_mode==4||u_mode==5){
    vec3 n=surfaceNormal();
    vec3 v=normalize(u_cameraPosition-v_worldPosition);
    float rawAo=1.0;
    if(u_useOcclusionMap){float sampledAo=texture(u_occlusionMap,uvSet(u_occlusionTexCoord)).r;rawAo=mix(1.0,sampledAo,u_occlusionStrength);}
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
      if(u_useMetallicMap)shadeTerm*=texture(u_metallicMap,uvSet(u_metallicTexCoord)).rgb;
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
    if(u_useEmissiveMap)emissive*=texture(u_emissiveMap,uvSet(u_emissiveTexCoord)).rgb;
    color=finalizeColor(color+emissive,v_worldPosition);
  }else if(u_mode==1){
    vec3 n=surfaceNormal();
    vec3 v=normalize(u_cameraPosition-v_worldPosition);
    float metallic=clamp(u_metallic,0.0,1.0);
    float roughness=clamp(u_roughness,0.045,1.0);
    if(u_useMetallicRoughnessMap){vec4 mr=texture(u_metallicRoughnessMap,uvSet(u_metallicRoughnessTexCoord));roughness*=mr.g;metallic*=mr.b;}
    if(u_useMetallicMap)metallic*=texture(u_metallicMap,uvSet(u_metallicTexCoord)).r;
    if(u_useRoughnessMap)roughness*=texture(u_roughnessMap,uvSet(u_roughnessTexCoord)).r;
    metallic=clamp(metallic,0.0,1.0);roughness=clamp(roughness,0.045,1.0);
    float ao=1.0;
    if(u_useOcclusionMap){float sampledAo=texture(u_occlusionMap,uvSet(u_occlusionTexCoord)).r;ao=mix(1.0,sampledAo,u_occlusionStrength);}
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
    if(u_useEmissiveMap)emissive*=texture(u_emissiveMap,uvSet(u_emissiveTexCoord)).rgb;
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
    vec3 n=surfaceNormal();vec3 v=normalize(u_cameraPosition-v_worldPosition);float ndotv=clamp(dot(n,v),0.0,1.0);float fresnel=pow(1.0-ndotv,max(0.5,u_waterParams.x));float depthHint=clamp(1.0-abs(n.y),0.0,1.0);vec3 shallow=srgbToLinear(u_waterShallowColor);vec3 deep=srgbToLinear(u_waterDeepColor);vec3 water=mix(shallow,deep,clamp(depthHint*u_waterParams.z,0.0,1.0));vec3 reflection=environmentSpecular(reflect(-v,n),clamp(u_roughness,0.045,1.0));color=mix(water,reflection,clamp(fresnel*u_waterParams.y,0.0,1.0));float foam=smoothstep(0.72,1.0,1.0-abs(n.y))*0.18;color=mix(color,srgbToLinear(u_waterFoamColor),foam);color=finalizeColor(color+srgbToLinear(u_emissive),v_worldPosition);outputAlpha=min(outputAlpha,0.82+fresnel*0.18);
  }else if(u_mode==0){color=finalizeColor(base,v_worldPosition);}
  else if(u_mode==2){color=surfaceNormal()*0.5+0.5;}
  else if(u_mode==3){color=vec3(gl_FragCoord.z);}
  outColor=vec4(color,outputAlpha);
}`

interface WebGLDisjointTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number
  readonly GPU_DISJOINT_EXT: number
}

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
  private whiteTexture?: WebGLTextureState
  private frameIndex = 0
  private occlusionCuller = new HierarchicalDepthCuller(64)
  private clusterGrid = new ClusteredLightGrid()
  private contextLost = false
  private postProcessPipeline?: WebGLPostProcessPipeline
  private lastFrameTime = 0
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
    this.createPrograms()
    this.postProcessPipeline = new WebGLPostProcessPipeline(gl)
    this.whiteTexture = createWhiteTexture(gl)
    if(this.environmentMap)this.environmentTexture=this.uploadEnvironmentMap(this.environmentMap)
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
    gl.viewport(viewport.x, viewport.y, Math.max(1, viewport.width), Math.max(1, viewport.height))
    if (options.clear ?? true) {
      gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }
    this.activeProgram = undefined
    const mainStarted = now()
    for (const item of queue.opaque) { this.drawInvertedHull(item, camera); this.drawMesh(item, camera, lights) }
    for (const item of queue.transparent) { this.drawInvertedHull(item, camera); this.drawMesh(item, camera, lights) }
    this.stats.mainPassMs = now() - mainStarted
    gl.bindVertexArray(null)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    this.activeProgram = undefined
    const postStarted = now()
    if(usePostProcess){this.postProcessPipeline?.composite(this.postProcessing,this.imageQuality,this.colorGrading,options.framebuffer??null);this.stats.postProcessPasses+=this.postProcessPipeline?.lastPassCount??1}
    this.stats.postProcessMs = now() - postStarted
    const residencyStarted = now()
    this.stats.textureEvictions += this.textureResidency.enforce(this.frameIndex)
    this.stats.geometryEvictions += this.geometryResidency.enforce(this.frameIndex)
    this.stats.residencyMs = now() - residencyStarted
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
        gl.uniformMatrix4fv(program.uniforms.model,false,mesh.worldMatrix.elements);this.stats.uniformUpdates+=1
        const gpu=this.getGeometry(mesh.geometry);gl.bindVertexArray(gpu.vao)
        if(mesh instanceof InstancedMesh){this.bindInstances(mesh);this.drawGeometryRange(gpu,entry.start,entry.count,mesh.count);this.stats.triangles+=(entry.count/3)*mesh.count;this.stats.instancedDrawCalls+=1;this.stats.instancesRendered+=mesh.count}
        else {this.drawGeometryRange(gpu,entry.start,entry.count,1);this.stats.triangles+=entry.count/3}
        this.stats.drawCalls+=1;this.stats.shadowDrawCalls+=1
      }
    }
    gl.colorMask(true,true,true,true);gl.cullFace(gl.BACK);gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.activeProgram=undefined;this.shadowAvailable=true
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
      for (const instance of this.instances.values()) gl.deleteBuffer(instance.buffer)
      for (const texture of this.textures.values()) gl.deleteTexture(texture.texture)
      if (this.whiteTexture) gl.deleteTexture(this.whiteTexture.texture)
      if (this.environmentTexture) gl.deleteTexture(this.environmentTexture.texture)
      if (this.environmentDiffuseTexture) gl.deleteTexture(this.environmentDiffuseTexture.texture)
      if (this.environmentBrdfTexture) gl.deleteTexture(this.environmentBrdfTexture.texture)
      this.releaseShadowResources()
    this.postProcessPipeline?.dispose()
    this.postProcessPipeline=undefined
      if (this.regular) gl.deleteProgram(this.regular.program)
      if (this.instanced) gl.deleteProgram(this.instanced.program)
      if (this.depthRegular) gl.deleteProgram(this.depthRegular.program)
      if (this.depthInstanced) gl.deleteProgram(this.depthInstanced.program)
      if (this.outlineRegular) gl.deleteProgram(this.outlineRegular.program)
      if (this.outlineInstanced) gl.deleteProgram(this.outlineInstanced.program)
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
    this.textures.clear()
    this.textureResidency.clear()
    this.geometryResidency.clear()
    this.environmentTexture = undefined
    this.environmentDiffuseTexture = undefined
    this.environmentBrdfTexture = undefined
    this.gl = undefined
    this.regular = undefined
    this.instanced = undefined
    this.depthRegular = undefined
    this.depthInstanced = undefined
    this.outlineRegular = undefined
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
      this.drawGeometryRange(gpu, item.start, item.count, mesh.count)
      this.stats.triangles += (item.count / 3) * mesh.count
      this.stats.instancedDrawCalls += 1
      this.stats.instancesRendered += mesh.count
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
    this.reportUnsupportedMaterial(mesh, material)
    if (material.side === 'double') gl.disable(gl.CULL_FACE)
    else { gl.enable(gl.CULL_FACE); gl.cullFace(material.side === 'back' ? gl.FRONT : gl.BACK) }
    if (material.transparent) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) } else gl.disable(gl.BLEND)
    gl.depthMask(material.depthWrite)
    gl.bindVertexArray(gpu.vao)
    if (mesh instanceof InstancedMesh) {
      this.bindInstances(mesh)
      this.drawGeometryRange(gpu, item.start, item.count, mesh.count)
      this.stats.triangles += (item.count / 3) * mesh.count
      this.stats.instancedDrawCalls += 1
      this.stats.instancesRendered += mesh.count
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
      const buffer = gl.createBuffer()
      if (!buffer) throw new Error('WebGL2 failed to allocate an instance buffer.')
      state = { buffer, version: -1, bytes: mesh.instanceMatrices.byteLength }
      this.instances.set(mesh, state)
      this.stats.geometryMemory += state.bytes
      this.stats.geometryUploads += 1
      this.stats.gpuResourceCreations += 1
      this.stats.gpuResourceCreationsThisFrame += 1
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer)
    if (state.version !== mesh.instanceVersion) { gl.bufferData(gl.ARRAY_BUFFER, mesh.instanceMatrices, gl.DYNAMIC_DRAW); state.version = mesh.instanceVersion; this.stats.uniformUpdates += 1 }
    for (let column = 0; column < 4; column += 1) {
      const location = 3 + column
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 64, column * 16)
      gl.vertexAttribDivisor(location, 1)
    }
  }

  private createPrograms(): void {
    const gl = this.gl as WebGL2RenderingContext
    this.regular = createProgramState(gl, regularVertex, fragmentSource)
    this.instanced = createProgramState(gl, instancedVertex, fragmentSource)
    this.depthRegular = createDepthProgramState(gl, depthVertex, depthFragment)
    this.depthInstanced = createDepthProgramState(gl, instancedDepthVertex, depthFragment)
    this.outlineRegular = createOutlineProgramState(gl, outlineVertex, outlineFragment)
    this.outlineInstanced = createOutlineProgramState(gl, instancedOutlineVertex, outlineFragment)
    this.shaderPrograms.clear()
    this.stats.shaderCompilations += 6
    this.stats.gpuResourceCreations += 6
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
      gl.deleteBuffer(state.buffer)
      this.stats.geometryMemory = Math.max(0, this.stats.geometryMemory - state.bytes)
      this.instances.delete(mesh)
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
    this.textures.clear()
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
  return { program, uniforms: { model: gl.getUniformLocation(program, 'u_model'), lightViewProjection: gl.getUniformLocation(program, 'u_lightViewProjection') } }
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
function defaultToonSurface(){return { textureScale:[1,1] as const,textureOffset:[0,0] as const,textureRotation:0,toonParams:[3,0.58,0.2,0.18] as const,toonParams2:[2.5,0.68,5,0] as const,toonParams3:[0.08,0,0.18,0] as const,mtoonAdvanced2:[0.12,0.08,0,0] as const,toonShadowColor:Color.from('#66708f'),toonHighlightColor:Color.from('#fff4df'),toonRimColor:Color.from('#ffd7e8'),toonOutlineColor:Color.from('#201a2a'),faceShadow:emptyBinding(),faceShadowStrength:0,faceShadowFlipX:false,hairAlphaDither:false,outlineWidth:0,lightMap:emptyBinding(),lightMapIntensity:1,specularFactor:1,specularColor:Color.from('#ffffff'),clearcoat:0,clearcoatRoughness:0.1,sheenColor:Color.from('#ffffff'),sheenIntensity:0,sheenRoughness:0.5,alphaDither:false,waterParams:[5,0.78,1,1] as const,waterShallowColor:Color.from('#55b8d6'),waterDeepColor:Color.from('#0a3f67'),waterFoamColor:Color.from('#e8fbff') }}
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
