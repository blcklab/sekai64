import { createBloomPyramid, packColorLutStrip, type RendererColorGrading, type RendererColorLut, type RendererImageQuality, type RendererPostProcessing } from '@sekai64-internal/renderer'

const fullscreenVertex = `#version 300 es
out vec2 v_uv;
void main(){
  vec2 p=gl_VertexID==0?vec2(-1.0,-1.0):gl_VertexID==1?vec2(3.0,-1.0):vec2(-1.0,3.0);
  v_uv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);
}`

const gtaoFragment = `#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform sampler2D u_depth;uniform vec2 u_resolution;uniform vec4 u_params;
float depthAt(vec2 uv){return texture(u_depth,clamp(uv,vec2(0.0),vec2(1.0))).r;}
vec3 depthNormal(vec2 uv){
  vec2 texel=1.0/max(u_resolution,vec2(1.0));float c=depthAt(uv);
  float l=depthAt(uv-vec2(texel.x,0));float r=depthAt(uv+vec2(texel.x,0));
  float d=depthAt(uv-vec2(0,texel.y));float u=depthAt(uv+vec2(0,texel.y));
  vec3 dx=vec3(2.0*texel.x,0.0,r-l);vec3 dy=vec3(0.0,2.0*texel.y,u-d);
  return normalize(cross(dx,dy));
}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float center=depthAt(v_uv);if(center>=0.9999){outColor=vec4(1.0);return;}
  vec2 texel=1.0/max(u_resolution,vec2(1.0));vec3 n=depthNormal(v_uv);
  float radius=max(1.0,u_params.x);float bias=u_params.z;float angle=hash(gl_FragCoord.xy)*6.2831853;
  float horizon=0.0;float weight=0.0;
  for(int direction=0;direction<8;direction++){
    float a=angle+float(direction)*0.785398;vec2 dir=vec2(cos(a),sin(a));
    float maxH=-1.0;
    for(int stepIndex=1;stepIndex<=4;stepIndex++){
      float stepLength=radius*(float(stepIndex)/4.0);vec2 sampleUv=v_uv+dir*texel*stepLength;
      float sampleDepth=depthAt(sampleUv);float delta=center-sampleDepth;
      float projected=delta/max(stepLength*0.012,0.0001);
      maxH=max(maxH,projected-bias);
    }
    float tangent=max(0.0,dot(n,normalize(vec3(dir,maxH))));
    horizon+=clamp(maxH,0.0,1.0)*(1.0-tangent);weight+=1.0;
  }
  float ao=clamp(1.0-(horizon/max(weight,1.0))*u_params.y,0.0,1.0);
  outColor=vec4(ao,ao,ao,1.0);
}`

const bilateralFragment = `#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform sampler2D u_input;uniform sampler2D u_depth;uniform vec2 u_resolution;uniform vec2 u_direction;uniform vec2 u_params;
void main(){
  vec2 texel=1.0/max(u_resolution,vec2(1.0));float centerDepth=texture(u_depth,v_uv).r;
  float sum=0.0;float total=0.0;int radius=int(clamp(u_params.x,1.0,4.0));
  for(int i=-4;i<=4;i++){
    if(abs(i)>radius)continue;vec2 uv=clamp(v_uv+u_direction*texel*float(i),vec2(0.0),vec2(1.0));
    float d=texture(u_depth,uv).r;float spatial=exp(-float(i*i)/max(1.0,float(radius*radius)));
    float depthWeight=exp(-abs(d-centerDepth)*u_params.y);float w=spatial*depthWeight;
    sum+=texture(u_input,uv).r*w;total+=w;
  }
  float value=sum/max(total,0.0001);outColor=vec4(value,value,value,1.0);
}`

const bloomFragment = `#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform sampler2D u_input;uniform vec2 u_resolution;uniform vec2 u_direction;uniform vec4 u_params;
float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
void main(){
  vec2 texel=1.0/max(u_resolution,vec2(1.0));
  if(u_params.x<0.5){
    vec3 color=texture(u_input,v_uv).rgb;float brightness=max(luma(color)-u_params.y,0.0);
    outColor=vec4(min(color*(brightness/max(luma(color),0.0001)),vec3(u_params.z)),1.0);return;
  }
  vec3 result=texture(u_input,v_uv).rgb*0.227027;
  result+=texture(u_input,v_uv+u_direction*texel*1.384615).rgb*0.316216;
  result+=texture(u_input,v_uv-u_direction*texel*1.384615).rgb*0.316216;
  result+=texture(u_input,v_uv+u_direction*texel*3.230769).rgb*0.070270;
  result+=texture(u_input,v_uv-u_direction*texel*3.230769).rgb*0.070270;
  outColor=vec4(result,1.0);
}`

const compositeFragment = `#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform sampler2D u_color;uniform sampler2D u_depth;uniform sampler2D u_ao;
uniform sampler2D u_bloom0;uniform sampler2D u_bloom1;uniform sampler2D u_bloom2;uniform sampler2D u_bloom3;
uniform sampler2D u_lut;
uniform vec2 u_resolution;uniform vec4 u_effects;uniform vec4 u_outline;uniform vec3 u_outlineColor;uniform vec4 u_bloomWeights;
uniform vec2 u_fxaa;uniform vec2 u_lutParams;
float luma(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
vec3 sampleScene(vec2 uv){return texture(u_color,clamp(uv,vec2(0.0),vec2(1.0))).rgb;}
vec3 fxaa(vec2 uv){
  vec2 texel=1.0/max(u_resolution,vec2(1.0));vec3 rgbM=sampleScene(uv);
  float lumaM=luma(rgbM),lumaNW=luma(sampleScene(uv+texel*vec2(-1,1))),lumaNE=luma(sampleScene(uv+texel*vec2(1,1))),lumaSW=luma(sampleScene(uv+texel*vec2(-1,-1))),lumaSE=luma(sampleScene(uv+texel*vec2(1,-1)));
  float lumaMin=min(lumaM,min(min(lumaNW,lumaNE),min(lumaSW,lumaSE)));float lumaMax=max(lumaM,max(max(lumaNW,lumaNE),max(lumaSW,lumaSE)));
  vec2 dir=vec2(-((lumaNW+lumaNE)-(lumaSW+lumaSE)),(lumaNW+lumaSW)-(lumaNE+lumaSE));
  float reduce=max((lumaNW+lumaNE+lumaSW+lumaSE)*0.03125,0.0078125);float rcp=1.0/(min(abs(dir.x),abs(dir.y))+reduce);dir=clamp(dir*rcp,vec2(-8.0),vec2(8.0))*texel;
  vec3 a=0.5*(sampleScene(uv+dir*(1.0/3.0-0.5))+sampleScene(uv+dir*(2.0/3.0-0.5)));
  vec3 b=a*0.5+0.25*(sampleScene(uv+dir*-0.5)+sampleScene(uv+dir*0.5));float lb=luma(b);
  vec3 result=(lb<lumaMin||lb>lumaMax)?a:b;
  if(u_fxaa.x>1.5){vec3 cross=(rgbM*2.0+sampleScene(uv+vec2(texel.x,0.0))+sampleScene(uv-vec2(texel.x,0.0))+sampleScene(uv+vec2(0.0,texel.y))+sampleScene(uv-vec2(0.0,texel.y)))/6.0;float contrast=max(lumaMax-lumaMin,0.00001);float subpixel=clamp(abs(luma(cross)-lumaM)/contrast,0.0,1.0);result=mix(result,cross,subpixel*0.18);}
  return result;
}
vec3 sampleLut(vec3 value){
  float size=max(2.0,u_lutParams.x);float maximum=size-1.0;vec3 c=clamp(value,vec3(0.0),vec3(1.0));float blue=c.b*maximum;float blue0=floor(blue);float blue1=min(maximum,blue0+1.0);float mixBlue=fract(blue);
  float stripWidth=size*size;float y=(c.g*maximum+0.5)/size;float x0=(blue0*size+c.r*maximum+0.5)/stripWidth;float x1=(blue1*size+c.r*maximum+0.5)/stripWidth;
  return mix(texture(u_lut,vec2(x0,y)).rgb,texture(u_lut,vec2(x1,y)).rgb,mixBlue);
}
void main(){
  vec2 texel=1.0/max(u_resolution,vec2(1.0));vec4 source=texture(u_color,v_uv);
  vec3 color=u_fxaa.x>0.5?fxaa(v_uv):source.rgb;
  if(u_effects.x>0.5)color*=mix(1.0,texture(u_ao,v_uv).r,u_effects.y);
  if(u_effects.z>0.5){vec3 bloom=texture(u_bloom0,v_uv).rgb*u_bloomWeights.x+texture(u_bloom1,v_uv).rgb*u_bloomWeights.y+texture(u_bloom2,v_uv).rgb*u_bloomWeights.z+texture(u_bloom3,v_uv).rgb*u_bloomWeights.w;color+=bloom*u_effects.w;}
  if(u_outline.x>0.5){float center=texture(u_depth,v_uv).r;float edge=0.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){if(x==0&&y==0)continue;edge=max(edge,abs(center-texture(u_depth,clamp(v_uv+vec2(float(x),float(y))*texel*u_outline.y,vec2(0.0),vec2(1.0))).r));}if(edge>u_outline.z)color=mix(color,u_outlineColor,clamp((edge-u_outline.z)*90.0,0.0,1.0));}
  if(u_lutParams.y>0.0)color=mix(color,sampleLut(color),clamp(u_lutParams.y,0.0,1.0));
  if(u_fxaa.y>0.0){vec3 blur=(sampleScene(v_uv+vec2(texel.x,0))+sampleScene(v_uv-vec2(texel.x,0))+sampleScene(v_uv+vec2(0,texel.y))+sampleScene(v_uv-vec2(0,texel.y)))*0.25;color=mix(color,color+(color-blur),clamp(u_fxaa.y,0.0,1.0));}
  outColor=vec4(color,source.a);
}`

interface Target { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number }
interface Program { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> }

export class WebGLPostProcessPipeline {
  private framebuffer?: WebGLFramebuffer
  private color?: WebGLTexture
  private depth?: WebGLTexture
  private vao?: WebGLVertexArrayObject
  private programs = new Map<string, Program>()
  private aoA?: Target
  private aoB?: Target
  private bloom: Array<{ a: Target; b: Target }> = []
  private lutTexture?: WebGLTexture
  private lutSource?: RendererColorLut
  private width = 0
  private height = 0
  lastPassCount = 0

  constructor(private readonly gl: WebGL2RenderingContext) {}
  get target(): WebGLFramebuffer | null { return this.framebuffer ?? null }

  ensure(width: number, height: number): void {
    width=Math.max(1,width);height=Math.max(1,height)
    if(this.framebuffer&&this.width===width&&this.height===height)return
    this.releaseTargets();this.width=width;this.height=height
    const gl=this.gl
    this.framebuffer=gl.createFramebuffer()??undefined;this.color=createTexture(gl,width,height,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);this.depth=gl.createTexture()??undefined
    if(!this.framebuffer||!this.color||!this.depth)throw new Error('WebGL2 could not allocate post-processing targets.')
    gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,width,height,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);configureTexture(gl,gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.color,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0)
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('WebGL2 post-processing framebuffer is incomplete.')
    gl.bindFramebuffer(gl.FRAMEBUFFER,null)
  }

  composite(configuration: RendererPostProcessing, imageQuality: RendererImageQuality, colorGrading: RendererColorGrading, target: WebGLFramebuffer | null = null): void {
    this.lastPassCount=0
    const gl=this.gl
    gl.bindVertexArray(this.vao ?? (this.vao=gl.createVertexArray()??undefined) as WebGLVertexArrayObject)
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(false)

    let aoTexture=this.color as WebGLTexture
    if(configuration.ssao.enabled){
      const scale=configuration.ssao.halfResolution?0.5:1
      const width=Math.max(1,Math.floor(this.width*scale)),height=Math.max(1,Math.floor(this.height*scale))
      this.aoA=ensureTarget(gl,this.aoA,width,height);this.aoB=ensureTarget(gl,this.aoB,width,height)
      const gtao=this.getProgram('gtao',gtaoFragment)
      drawTarget(gl,gtao,this.aoA,()=>{bindTexture(gl,gtao,'u_depth',0,this.depth as WebGLTexture);uniform2(gl,gtao,'u_resolution',this.width,this.height);uniform4(gl,gtao,'u_params',configuration.ssao.radius*12,configuration.ssao.intensity,configuration.ssao.bias,configuration.ssao.directions)});this.lastPassCount++
      aoTexture=this.aoA.texture
      if(configuration.ssao.denoise){
        const blur=this.getProgram('bilateral',bilateralFragment)
        drawTarget(gl,blur,this.aoB,()=>{bindTexture(gl,blur,'u_input',0,this.aoA?.texture as WebGLTexture);bindTexture(gl,blur,'u_depth',1,this.depth as WebGLTexture);uniform2(gl,blur,'u_resolution',width,height);uniform2(gl,blur,'u_direction',1,0);uniform2(gl,blur,'u_params',configuration.ssao.denoiseRadius,240)});this.lastPassCount++
        drawTarget(gl,blur,this.aoA,()=>{bindTexture(gl,blur,'u_input',0,this.aoB?.texture as WebGLTexture);bindTexture(gl,blur,'u_depth',1,this.depth as WebGLTexture);uniform2(gl,blur,'u_resolution',width,height);uniform2(gl,blur,'u_direction',0,1);uniform2(gl,blur,'u_params',configuration.ssao.denoiseRadius,240)});this.lastPassCount++
        aoTexture=this.aoA.texture
      }
    }

    const plan=createBloomPyramid(this.width,this.height,Math.min(4,configuration.bloom.levels),configuration.bloom.scatter)
    while(this.bloom.length<plan.length)this.bloom.push({a:ensureTarget(gl,undefined,1,1),b:ensureTarget(gl,undefined,1,1)})
    const bloomProgram=this.getProgram('bloom',bloomFragment)
    const bloomTextures: WebGLTexture[]=[]
    if(configuration.bloom.enabled){
      let source=this.color as WebGLTexture
      for(const level of plan){
        const pair=this.bloom[level.index] as {a:Target;b:Target};pair.a=ensureTarget(gl,pair.a,level.width,level.height);pair.b=ensureTarget(gl,pair.b,level.width,level.height)
        drawTarget(gl,bloomProgram,pair.a,()=>{bindTexture(gl,bloomProgram,'u_input',0,source);uniform2(gl,bloomProgram,'u_resolution',level.width,level.height);uniform2(gl,bloomProgram,'u_direction',0,0);uniform4(gl,bloomProgram,'u_params',level.index===0?0:1,configuration.bloom.threshold,configuration.bloom.clamp,0)});this.lastPassCount++
        drawTarget(gl,bloomProgram,pair.b,()=>{bindTexture(gl,bloomProgram,'u_input',0,pair.a.texture);uniform2(gl,bloomProgram,'u_resolution',level.width,level.height);uniform2(gl,bloomProgram,'u_direction',1+configuration.bloom.radius*2,0);uniform4(gl,bloomProgram,'u_params',1,0,configuration.bloom.clamp,0)});this.lastPassCount++
        drawTarget(gl,bloomProgram,pair.a,()=>{bindTexture(gl,bloomProgram,'u_input',0,pair.b.texture);uniform2(gl,bloomProgram,'u_resolution',level.width,level.height);uniform2(gl,bloomProgram,'u_direction',0,1+configuration.bloom.radius*2);uniform4(gl,bloomProgram,'u_params',1,0,configuration.bloom.clamp,0)});this.lastPassCount++
        bloomTextures.push(pair.a.texture);source=pair.a.texture
      }
    }

    const composite=this.getProgram('composite',compositeFragment)
    gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,this.width,this.height);gl.useProgram(composite.program)
    bindTexture(gl,composite,'u_color',0,this.color as WebGLTexture);bindTexture(gl,composite,'u_depth',1,this.depth as WebGLTexture);bindTexture(gl,composite,'u_ao',2,aoTexture)
    for(let i=0;i<4;i++)bindTexture(gl,composite,`u_bloom${i}`,3+i,bloomTextures[i]??this.color as WebGLTexture)
    const lut=this.ensureLutTexture(colorGrading.lut)
    bindTexture(gl,composite,'u_lut',7,lut??this.color as WebGLTexture)
    uniform2(gl,composite,'u_resolution',this.width,this.height)
    uniform4(gl,composite,'u_effects',configuration.ssao.enabled?1:0,configuration.ssao.intensity,configuration.bloom.enabled?1:0,configuration.bloom.strength)
    const screenOutlines=configuration.outlines.enabled&&!configuration.outlines.charactersOnly&&(configuration.outlines.mode==='screen-space'||configuration.outlines.mode==='hybrid')
    uniform4(gl,composite,'u_outline',screenOutlines?1:0,configuration.outlines.thickness,configuration.outlines.depthThreshold,configuration.outlines.normalThreshold)
    const outline=composite.uniforms.get('u_outlineColor');if(outline)gl.uniform3f(outline,...configuration.outlines.color)
    const weights=[0,0,0,0];for(const level of plan)weights[level.index]=level.weight
    uniform4(gl,composite,'u_bloomWeights',weights[0]??0,weights[1]??0,weights[2]??0,weights[3]??0)
    uniform2(gl,composite,'u_fxaa',imageQuality.antialiasing==='fxaa-high'?2:imageQuality.antialiasing==='fxaa'?1:0,imageQuality.sharpen)
    uniform2(gl,composite,'u_lutParams',colorGrading.lut?.size??2,colorGrading.enabled&&colorGrading.lut?colorGrading.lutIntensity:0)
    gl.drawArrays(gl.TRIANGLES,0,3);this.lastPassCount++
    gl.bindVertexArray(null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE)
  }

  dispose(): void {this.releaseTargets();if(this.lutTexture)this.gl.deleteTexture(this.lutTexture);this.lutTexture=undefined;this.lutSource=undefined;for(const state of this.programs.values())this.gl.deleteProgram(state.program);this.programs.clear();if(this.vao)this.gl.deleteVertexArray(this.vao);this.vao=undefined}

  private getProgram(key:string,fragment:string):Program{
    const cached=this.programs.get(key);if(cached)return cached
    const program=createProgram(this.gl,fullscreenVertex,fragment);const names=['u_color','u_depth','u_input','u_resolution','u_params','u_direction','u_ao','u_bloom0','u_bloom1','u_bloom2','u_bloom3','u_lut','u_effects','u_outline','u_outlineColor','u_bloomWeights','u_fxaa','u_lutParams'];const uniforms=new Map<string,WebGLUniformLocation|null>();for(const name of names)uniforms.set(name,this.gl.getUniformLocation(program,name));const state={program,uniforms};this.programs.set(key,state);return state
  }
  private ensureLutTexture(lut?:RendererColorLut):WebGLTexture|undefined{if(!lut)return undefined;if(this.lutTexture&&this.lutSource===lut)return this.lutTexture;const gl=this.gl;if(this.lutTexture)gl.deleteTexture(this.lutTexture);const strip=packColorLutStrip(lut);const texture=gl.createTexture();if(!texture)throw new Error('WebGL2 color LUT texture allocation failed.');gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,strip.width,strip.height,0,gl.RGBA,gl.UNSIGNED_BYTE,strip.pixels);configureTexture(gl,gl.LINEAR);this.lutTexture=texture;this.lutSource=lut;return texture}
  private releaseTargets():void{const gl=this.gl;if(this.color)gl.deleteTexture(this.color);if(this.depth)gl.deleteTexture(this.depth);if(this.framebuffer)gl.deleteFramebuffer(this.framebuffer);releaseTarget(gl,this.aoA);releaseTarget(gl,this.aoB);for(const pair of this.bloom){releaseTarget(gl,pair.a);releaseTarget(gl,pair.b)}this.bloom=[];this.aoA=undefined;this.aoB=undefined;this.color=undefined;this.depth=undefined;this.framebuffer=undefined;this.width=0;this.height=0}
}

function createTexture(gl:WebGL2RenderingContext,width:number,height:number,internal:number,format:number,type:number):WebGLTexture{const texture=gl.createTexture();if(!texture)throw new Error('WebGL2 post-process texture allocation failed.');gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,internal,width,height,0,format,type,null);configureTexture(gl,gl.LINEAR);return texture}
function configureTexture(gl:WebGL2RenderingContext,filter:number):void{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
function ensureTarget(gl:WebGL2RenderingContext,target:Target|undefined,width:number,height:number):Target{if(target&&target.width===width&&target.height===height)return target;releaseTarget(gl,target);const texture=createTexture(gl,width,height,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);const framebuffer=gl.createFramebuffer();if(!framebuffer)throw new Error('WebGL2 post-process framebuffer allocation failed.');gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('WebGL2 intermediate framebuffer is incomplete.');return{texture,framebuffer,width,height}}
function releaseTarget(gl:WebGL2RenderingContext,target?:Target):void{if(!target)return;gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.framebuffer)}
function drawTarget(gl:WebGL2RenderingContext,program:Program,target:Target,configure:()=>void):void{gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,target.width,target.height);gl.useProgram(program.program);configure();gl.drawArrays(gl.TRIANGLES,0,3)}
function bindTexture(gl:WebGL2RenderingContext,program:Program,name:string,unit:number,texture:WebGLTexture):void{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);const location=program.uniforms.get(name);if(location)gl.uniform1i(location,unit)}
function uniform2(gl:WebGL2RenderingContext,program:Program,name:string,a:number,b:number):void{const location=program.uniforms.get(name);if(location)gl.uniform2f(location,a,b)}
function uniform4(gl:WebGL2RenderingContext,program:Program,name:string,a:number,b:number,c:number,d:number):void{const location=program.uniforms.get(name);if(location)gl.uniform4f(location,a,b,c,d)}
function createProgram(gl:WebGL2RenderingContext,vertexSource:string,fragmentSource:string):WebGLProgram{const compile=(type:number,source:string)=>{const shader=gl.createShader(type);if(!shader)throw new Error('WebGL2 post-process shader allocation failed.');gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader)??'Post-process shader compilation failed.';gl.deleteShader(shader);throw new Error(log)}return shader};const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource),program=gl.createProgram();if(!program)throw new Error('WebGL2 post-process program allocation failed.');gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??'Post-process program link failed.');return program}
