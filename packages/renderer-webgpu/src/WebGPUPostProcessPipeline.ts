/// <reference path="./webgpu.d.ts" />
import { createBloomPyramid, packColorLutStrip, type RendererColorGrading, type RendererColorLut, type RendererImageQuality, type RendererPostProcessing } from '@sekai64-internal/renderer'

const shaderSource = `
struct Params {
  resolution: vec4<f32>,
  modeParams: vec4<f32>,
  effectParams: vec4<f32>,
  outline: vec4<f32>,
  outlineColor: vec4<f32>,
  bloomWeights: vec4<f32>,
  fxaa: vec4<f32>,
  lut: vec4<f32>,
}
@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var depthTexture: texture_depth_2d;
@group(0) @binding(3) var auxiliaryTexture: texture_2d<f32>;
@group(0) @binding(4) var bloom0: texture_2d<f32>;
@group(0) @binding(5) var bloom1: texture_2d<f32>;
@group(0) @binding(6) var bloom2: texture_2d<f32>;
@group(0) @binding(7) var bloom3: texture_2d<f32>;
@group(0) @binding(8) var<uniform> params: Params;
@group(0) @binding(9) var lutTexture: texture_2d<f32>;

struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn vertex_main(@builtin(vertex_index) index: u32) -> VertexOutput {
  var positions=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  var output:VertexOutput;let p=positions[index];output.position=vec4<f32>(p,0.0,1.0);output.uv=vec2<f32>(p.x*0.5+0.5,0.5-p.y*0.5);return output;
}
fn luminance(value:vec3<f32>)->f32{return dot(value,vec3<f32>(0.299,0.587,0.114));}
fn readDepth(pixel:vec2<i32>)->f32{let dimensions=vec2<i32>(textureDimensions(depthTexture));return textureLoad(depthTexture,clamp(pixel,vec2<i32>(0),dimensions-vec2<i32>(1)),0);}
fn depthAt(uv:vec2<f32>)->f32{let dimensions=vec2<i32>(textureDimensions(depthTexture));let pixel=clamp(vec2<i32>(uv*vec2<f32>(dimensions)),vec2<i32>(0),dimensions-vec2<i32>(1));return readDepth(pixel);}
fn depthNormal(uv:vec2<f32>)->vec3<f32>{let dimensions=max(vec2<f32>(textureDimensions(depthTexture)),vec2<f32>(1.0));let texel=vec2<f32>(1.0)/dimensions;let l=depthAt(uv-vec2<f32>(texel.x,0.0));let r=depthAt(uv+vec2<f32>(texel.x,0.0));let d=depthAt(uv-vec2<f32>(0.0,texel.y));let u=depthAt(uv+vec2<f32>(0.0,texel.y));return normalize(cross(vec3<f32>(2.0*texel.x,0.0,r-l),vec3<f32>(0.0,2.0*texel.y,u-d)));}
fn hash(p:vec2<f32>)->f32{return fract(sin(dot(p,vec2<f32>(12.9898,78.233)))*43758.5453);}
fn scene(uv:vec2<f32>)->vec3<f32>{return textureSampleLevel(inputTexture,linearSampler,clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0)),0.0).rgb;}
fn fxaa(uv:vec2<f32>)->vec3<f32>{
  let texel=vec2<f32>(1.0)/max(params.resolution.xy,vec2<f32>(1.0));let rgbM=scene(uv);let lumaM=luminance(rgbM);
  let lumaNW=luminance(scene(uv+texel*vec2<f32>(-1.0,1.0)));let lumaNE=luminance(scene(uv+texel*vec2<f32>(1.0,1.0)));let lumaSW=luminance(scene(uv+texel*vec2<f32>(-1.0,-1.0)));let lumaSE=luminance(scene(uv+texel*vec2<f32>(1.0,-1.0)));
  let lumaMin=min(lumaM,min(min(lumaNW,lumaNE),min(lumaSW,lumaSE)));let lumaMax=max(lumaM,max(max(lumaNW,lumaNE),max(lumaSW,lumaSE)));
  var dir=vec2<f32>(-((lumaNW+lumaNE)-(lumaSW+lumaSE)),(lumaNW+lumaSW)-(lumaNE+lumaSE));let reduce=max((lumaNW+lumaNE+lumaSW+lumaSE)*0.03125,0.0078125);let reciprocal=1.0/(min(abs(dir.x),abs(dir.y))+reduce);dir=clamp(dir*reciprocal,vec2<f32>(-8.0),vec2<f32>(8.0))*texel;
  let a=0.5*(scene(uv+dir*(1.0/3.0-0.5))+scene(uv+dir*(2.0/3.0-0.5)));let b=a*0.5+0.25*(scene(uv+dir*-0.5)+scene(uv+dir*0.5));let lb=luminance(b);var result=select(b,a,lb<lumaMin||lb>lumaMax);if(params.fxaa.x>1.5){let cross=(rgbM*2.0+scene(uv+vec2<f32>(texel.x,0.0))+scene(uv-vec2<f32>(texel.x,0.0))+scene(uv+vec2<f32>(0.0,texel.y))+scene(uv-vec2<f32>(0.0,texel.y)))/6.0;let contrast=max(lumaMax-lumaMin,0.00001);let subpixel=clamp(abs(luminance(cross)-lumaM)/contrast,0.0,1.0);result=mix(result,cross,vec3<f32>(subpixel*0.18));}return result;
}
fn sampleLut(value:vec3<f32>)->vec3<f32>{
  let size=max(2.0,params.lut.y);let maximum=size-1.0;let c=clamp(value,vec3<f32>(0.0),vec3<f32>(1.0));let blue=c.b*maximum;let blue0=floor(blue);let blue1=min(maximum,blue0+1.0);let mixBlue=fract(blue);let stripWidth=size*size;let y=(c.g*maximum+0.5)/size;let x0=(blue0*size+c.r*maximum+0.5)/stripWidth;let x1=(blue1*size+c.r*maximum+0.5)/stripWidth;return mix(textureSampleLevel(lutTexture,linearSampler,vec2<f32>(x0,y),0.0).rgb,textureSampleLevel(lutTexture,linearSampler,vec2<f32>(x1,y),0.0).rgb,mixBlue);
}
@fragment fn fragment_main(input:VertexOutput)->@location(0) vec4<f32>{
  let mode=i32(params.modeParams.x);let resolution=max(params.resolution.xy,vec2<f32>(1.0));let texel=vec2<f32>(1.0)/resolution;
  if(mode==0){
    let center=depthAt(input.uv);if(center>=0.9999){return vec4<f32>(1.0);}let n=depthNormal(input.uv);let radius=max(1.0,params.modeParams.y);let intensity=params.modeParams.z;let bias=params.modeParams.w;let angle=hash(input.position.xy)*6.2831853;var horizon=0.0;
    for(var direction=0;direction<8;direction=direction+1){let a=angle+f32(direction)*0.785398;let dir=vec2<f32>(cos(a),sin(a));var maximum=-1.0;for(var stepIndex=1;stepIndex<=4;stepIndex=stepIndex+1){let distance=radius*(f32(stepIndex)/4.0);let delta=center-depthAt(input.uv+dir*texel*distance);maximum=max(maximum,delta/max(distance*0.012,0.0001)-bias);}let tangent=max(0.0,dot(n,normalize(vec3<f32>(dir,maximum))));horizon=horizon+clamp(maximum,0.0,1.0)*(1.0-tangent);}let ao=clamp(1.0-(horizon/8.0)*intensity,0.0,1.0);return vec4<f32>(ao,ao,ao,1.0);
  }
  if(mode==1){
    let centerDepth=depthAt(input.uv);let direction=params.modeParams.yz;let radius=i32(clamp(params.modeParams.w,1.0,4.0));var sum=0.0;var total=0.0;for(var i=-4;i<=4;i=i+1){if(abs(i)>radius){continue;}let uv=clamp(input.uv+direction*texel*f32(i),vec2<f32>(0.0),vec2<f32>(1.0));let depthWeight=exp(-abs(depthAt(uv)-centerDepth)*240.0);let spatial=exp(-f32(i*i)/max(1.0,f32(radius*radius)));let weight=depthWeight*spatial;sum=sum+textureSampleLevel(inputTexture,linearSampler,uv,0.0).r*weight;total=total+weight;}let value=sum/max(total,0.0001);return vec4<f32>(value,value,value,1.0);
  }
  if(mode==2){let color=scene(input.uv);let brightness=max(luminance(color)-params.modeParams.y,0.0);return vec4<f32>(min(color*(brightness/max(luminance(color),0.0001)),vec3<f32>(params.modeParams.z)),1.0);}
  if(mode==3){let direction=params.modeParams.yz;var result=scene(input.uv)*0.227027;result=result+scene(input.uv+direction*texel*1.384615)*0.316216+scene(input.uv-direction*texel*1.384615)*0.316216;result=result+scene(input.uv+direction*texel*3.230769)*0.070270+scene(input.uv-direction*texel*3.230769)*0.070270;return vec4<f32>(result,1.0);}
  var color=select(scene(input.uv),fxaa(input.uv),params.fxaa.x>0.5);
  if(params.effectParams.x>0.5){color=color*mix(1.0,textureSampleLevel(auxiliaryTexture,linearSampler,input.uv,0.0).r,params.effectParams.y);}
  if(params.effectParams.z>0.5){let glow=textureSampleLevel(bloom0,linearSampler,input.uv,0.0).rgb*params.bloomWeights.x+textureSampleLevel(bloom1,linearSampler,input.uv,0.0).rgb*params.bloomWeights.y+textureSampleLevel(bloom2,linearSampler,input.uv,0.0).rgb*params.bloomWeights.z+textureSampleLevel(bloom3,linearSampler,input.uv,0.0).rgb*params.bloomWeights.w;color=color+glow*params.effectParams.w;}
  if(params.outline.x>0.5){let center=depthAt(input.uv);var edge=0.0;for(var y=-1;y<=1;y=y+1){for(var x=-1;x<=1;x=x+1){if(x==0&&y==0){continue;}edge=max(edge,abs(center-depthAt(input.uv+vec2<f32>(f32(x),f32(y))*texel*params.outline.y)));}}if(edge>params.outline.z){color=mix(color,params.outlineColor.rgb,vec3<f32>(clamp((edge-params.outline.z)*90.0,0.0,1.0)));}}
  if(params.lut.x>0.5){color=mix(color,sampleLut(color),vec3<f32>(clamp(params.lut.z,0.0,1.0)));}
  if(params.fxaa.y>0.0){let blur=(scene(input.uv+vec2<f32>(texel.x,0.0))+scene(input.uv-vec2<f32>(texel.x,0.0))+scene(input.uv+vec2<f32>(0.0,texel.y))+scene(input.uv-vec2<f32>(0.0,texel.y)))*0.25;color=mix(color,color+(color-blur),vec3<f32>(clamp(params.fxaa.y,0.0,1.0)));}
  return vec4<f32>(color,1.0);
}`

interface Target { texture:GPUTexture; view:GPUTextureView; width:number; height:number }

export class WebGPUPostProcessPipeline {
  private color?:GPUTexture;private depth?:GPUTexture;private colorView?:GPUTextureView;private depthView?:GPUTextureView
  private sampler?:GPUSampler;private bindGroupLayout?:GPUBindGroupLayout;private pipelineLayout?:GPUPipelineLayout;private pipeline?:GPURenderPipeline
  private aoA?:Target;private aoB?:Target;private bloom:Array<{a:Target;b:Target}>=[];private params:GPUBuffer[]=[]
  private lutTexture?:GPUTexture;private lutView?:GPUTextureView;private lutSource?:RendererColorLut;private fallbackLut?:GPUTexture;private fallbackLutView?:GPUTextureView
  private width=0;private height=0;private format:GPUTextureFormat='bgra8unorm'
  lastPassCount=0
  constructor(private readonly device:GPUDevice){}
  get targetColorView():GPUTextureView{if(!this.colorView)throw new Error('WebGPU post-processing color target is not initialized.');return this.colorView}
  get targetDepthView():GPUTextureView{if(!this.depthView)throw new Error('WebGPU post-processing depth target is not initialized.');return this.depthView}

  ensure(width:number,height:number,format:GPUTextureFormat):void{
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));if(this.color&&this.width===width&&this.height===height&&this.format===format)return
    this.releaseTargets();this.width=width;this.height=height;this.format=format
    this.color=this.device.createTexture({label:'Sekai64 post color',size:[width,height,1],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.depth=this.device.createTexture({label:'Sekai64 post depth',size:[width,height,1],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.colorView=this.color.createView();this.depthView=this.depth.createView();this.ensurePipeline()
  }

  composite(encoder:GPUCommandEncoder,target:GPUTextureView,configuration:RendererPostProcessing,imageQuality:RendererImageQuality,colorGrading:RendererColorGrading):void{
    this.ensurePipeline();this.lastPassCount=0;let aoView=this.colorView as GPUTextureView
    if(configuration.ssao.enabled){const scale=configuration.ssao.halfResolution?0.5:1;const width=Math.max(1,Math.floor(this.width*scale)),height=Math.max(1,Math.floor(this.height*scale));this.aoA=this.ensureTarget(this.aoA,width,height);this.aoB=this.ensureTarget(this.aoB,width,height);this.draw(encoder,this.aoA.view,this.colorView as GPUTextureView,this.colorView as GPUTextureView,[width,height,0,0],[0,configuration.ssao.radius*12,configuration.ssao.intensity,configuration.ssao.bias]);aoView=this.aoA.view;if(configuration.ssao.denoise){this.draw(encoder,this.aoB.view,this.aoA.view,this.colorView as GPUTextureView,[width,height,0,0],[1,1,0,configuration.ssao.denoiseRadius]);this.draw(encoder,this.aoA.view,this.aoB.view,this.colorView as GPUTextureView,[width,height,0,0],[1,0,1,configuration.ssao.denoiseRadius]);aoView=this.aoA.view}}
    const plan=createBloomPyramid(this.width,this.height,Math.min(4,configuration.bloom.levels),configuration.bloom.scatter);while(this.bloom.length<plan.length)this.bloom.push({a:this.ensureTarget(undefined,1,1),b:this.ensureTarget(undefined,1,1)});const bloomViews:GPUTextureView[]=[]
    if(configuration.bloom.enabled){let source=this.colorView as GPUTextureView;for(const level of plan){const pair=this.bloom[level.index] as {a:Target;b:Target};pair.a=this.ensureTarget(pair.a,level.width,level.height);pair.b=this.ensureTarget(pair.b,level.width,level.height);this.draw(encoder,pair.a.view,source,this.colorView as GPUTextureView,[level.width,level.height,0,0],[2,configuration.bloom.threshold,configuration.bloom.clamp,0]);this.draw(encoder,pair.b.view,pair.a.view,this.colorView as GPUTextureView,[level.width,level.height,0,0],[3,1+configuration.bloom.radius*2,0,0]);this.draw(encoder,pair.a.view,pair.b.view,this.colorView as GPUTextureView,[level.width,level.height,0,0],[3,0,1+configuration.bloom.radius*2,0]);bloomViews.push(pair.a.view);source=pair.a.view}}
    const lutView=this.ensureLutTexture(colorGrading.lut);const values=new Float32Array(36);values.set([this.width,this.height,0,0],0);values.set([4,0,0,0],4);values.set([configuration.ssao.enabled?1:0,configuration.ssao.intensity,configuration.bloom.enabled?1:0,configuration.bloom.strength],8);const screenOutlines=configuration.outlines.enabled&&!configuration.outlines.charactersOnly&&(configuration.outlines.mode==='screen-space'||configuration.outlines.mode==='hybrid');values.set([screenOutlines?1:0,configuration.outlines.thickness,configuration.outlines.depthThreshold,configuration.outlines.normalThreshold],12);values.set([...configuration.outlines.color,0],16);const weights=[0,0,0,0];for(const level of plan)weights[level.index]=level.weight;values.set(weights,20);values.set([imageQuality.antialiasing==='fxaa-high'?2:imageQuality.antialiasing==='fxaa'?1:0,imageQuality.sharpen,0,0],24);values.set([colorGrading.enabled&&colorGrading.lut?1:0,colorGrading.lut?.size??2,colorGrading.lutIntensity,0],28)
    this.draw(encoder,target,this.colorView as GPUTextureView,aoView,[this.width,this.height,0,0],[4,0,0,0],values,bloomViews,lutView)
  }

  dispose():void{this.releaseTargets();this.lutTexture?.destroy();this.fallbackLut?.destroy();this.lutTexture=undefined;this.lutView=undefined;this.lutSource=undefined;this.fallbackLut=undefined;this.fallbackLutView=undefined;for(const buffer of this.params)buffer.destroy();this.params=[];this.pipeline=undefined;this.pipelineLayout=undefined;this.bindGroupLayout=undefined;this.sampler=undefined}

  private draw(encoder:GPUCommandEncoder,target:GPUTextureView,input:GPUTextureView,auxiliary:GPUTextureView,resolution:readonly number[],mode:readonly number[],provided?:Float32Array,bloomViews:readonly GPUTextureView[]=[],lutView?:GPUTextureView):void{
    const index=this.lastPassCount++;let buffer=this.params[index];if(!buffer){buffer=this.device.createBuffer({label:`Sekai64 post params ${index}`,size:144,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.params[index]=buffer}const values=provided??new Float32Array(36);if(!provided){values.set(resolution,0);values.set(mode,4)}this.device.queue.writeBuffer(buffer,0,values)
    const fallback=this.colorView as GPUTextureView;const group=this.device.createBindGroup({label:'Sekai64 post-process bindings',layout:this.bindGroupLayout as GPUBindGroupLayout,entries:[{binding:0,resource:this.sampler as GPUSampler},{binding:1,resource:input},{binding:2,resource:this.depthView as GPUTextureView},{binding:3,resource:auxiliary},{binding:4,resource:bloomViews[0]??fallback},{binding:5,resource:bloomViews[1]??fallback},{binding:6,resource:bloomViews[2]??fallback},{binding:7,resource:bloomViews[3]??fallback},{binding:8,resource:{buffer}},{binding:9,resource:lutView??this.ensureFallbackLut()}]})
    const pass=encoder.beginRenderPass({label:'Sekai64 post-process pass',colorAttachments:[{view:target,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(this.pipeline as GPURenderPipeline);pass.setBindGroup(0,group);pass.draw(3,1);pass.end()
  }

  private ensurePipeline():void{if(this.pipeline&&this.sampler)return;this.sampler=this.device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});this.bindGroupLayout=this.device.createBindGroupLayout({label:'Sekai64 post-process layout',entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'depth'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:7,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:8,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:9,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}}]});this.pipelineLayout=this.device.createPipelineLayout({label:'Sekai64 post-process pipeline layout',bindGroupLayouts:[this.bindGroupLayout]});const module=this.device.createShaderModule({label:'Sekai64 post-process shader',code:shaderSource});this.pipeline=this.device.createRenderPipeline({label:'Sekai64 post-process pipeline',layout:this.pipelineLayout,vertex:{module,entryPoint:'vertex_main'},fragment:{module,entryPoint:'fragment_main',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}})}
  private ensureLutTexture(lut?:RendererColorLut):GPUTextureView{if(!lut)return this.ensureFallbackLut();if(this.lutTexture&&this.lutView&&this.lutSource===lut)return this.lutView;this.lutTexture?.destroy();const strip=packColorLutStrip(lut);const texture=this.device.createTexture({label:`Sekai64 color LUT ${lut.label??''}`,size:[strip.width,strip.height,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});writeRgba8(this.device,texture,strip.width,strip.height,strip.pixels);this.lutTexture=texture;this.lutView=texture.createView();this.lutSource=lut;return this.lutView}
  private ensureFallbackLut():GPUTextureView{if(this.fallbackLut&&this.fallbackLutView)return this.fallbackLutView;const pixels=new Uint8Array([0,0,0,255,255,0,0,255,0,255,0,255,255,255,0,255,0,0,255,255,255,0,255,255,0,255,255,255,255,255,255,255]);const texture=this.device.createTexture({label:'Sekai64 identity fallback LUT',size:[4,2,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});writeRgba8(this.device,texture,4,2,pixels);this.fallbackLut=texture;this.fallbackLutView=texture.createView();return this.fallbackLutView}
  private ensureTarget(target:Target|undefined,width:number,height:number):Target{if(target&&target.width===width&&target.height===height)return target;target?.texture.destroy();const texture=this.device.createTexture({label:'Sekai64 post intermediate',size:[width,height,1],format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});return{texture,view:texture.createView(),width,height}}
  private releaseTargets():void{this.color?.destroy();this.depth?.destroy();this.aoA?.texture.destroy();this.aoB?.texture.destroy();for(const pair of this.bloom){pair.a.texture.destroy();pair.b.texture.destroy()}this.bloom=[];this.color=undefined;this.depth=undefined;this.colorView=undefined;this.depthView=undefined;this.aoA=undefined;this.aoB=undefined;this.width=0;this.height=0}
}

function writeRgba8(device:GPUDevice,texture:GPUTexture,width:number,height:number,pixels:Uint8Array):void{
  const bytesPerRow=width*4
  const paddedBytesPerRow=Math.ceil(bytesPerRow/256)*256
  if(paddedBytesPerRow===bytesPerRow){device.queue.writeTexture({texture},pixels,{bytesPerRow,rowsPerImage:height},[width,height,1]);return}
  const padded=new Uint8Array(paddedBytesPerRow*height)
  for(let row=0;row<height;row+=1)padded.set(pixels.subarray(row*bytesPerRow,(row+1)*bytesPerRow),row*paddedBytesPerRow)
  device.queue.writeTexture({texture},padded,{bytesPerRow:paddedBytesPerRow,rowsPerImage:height},[width,height,1])
}
