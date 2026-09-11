import type { PostProcessContext, PostProcessPass } from './PostProcessGraph.js'

export type ToneMappingMode = 'linear' | 'reinhard' | 'aces' | 'neutral'
export interface ToneMappingOptions { mode?: ToneMappingMode; exposure?: number; gamma?: number }

export class ToneMappingPass implements PostProcessPass<ImageData> {
  readonly name = 'tone-mapping'
  enabled = true
  mode: ToneMappingMode
  exposure: number
  gamma: number
  constructor(options: ToneMappingOptions = {}) { this.mode=options.mode??'aces'; this.exposure=Math.max(0,options.exposure??1); this.gamma=Math.max(0.1,options.gamma??2.2) }
  process({frame}: PostProcessContext<ImageData>): ImageData {
    const data=frame.data
    for(let i=0;i<data.length;i+=4){
      data[i]=toByte(tone((data[i]??0)/255*this.exposure,this.mode),this.gamma)
      data[i+1]=toByte(tone((data[i+1]??0)/255*this.exposure,this.mode),this.gamma)
      data[i+2]=toByte(tone((data[i+2]??0)/255*this.exposure,this.mode),this.gamma)
    }
    return frame
  }
}

export interface BloomOptions { threshold?: number; intensity?: number; radius?: number }
export class BloomPass implements PostProcessPass<ImageData> {
  readonly name = 'bloom'
  enabled = true
  threshold: number
  intensity: number
  radius: number
  constructor(options: BloomOptions = {}) { this.threshold=clamp(options.threshold??0.8,0,1); this.intensity=Math.max(0,options.intensity??0.35); this.radius=Math.max(1,Math.floor(options.radius??3)) }
  process({frame,width,height}: PostProcessContext<ImageData>): ImageData {
    const source=frame.data, bright=new Float32Array(source.length), blurred=new Float32Array(source.length)
    for(let i=0;i<source.length;i+=4){ const r=(source[i]??0)/255,g=(source[i+1]??0)/255,b=(source[i+2]??0)/255; const luminance=r*0.2126+g*0.7152+b*0.0722; if(luminance>=this.threshold){bright[i]=r;bright[i+1]=g;bright[i+2]=b} }
    boxBlur(bright,blurred,width,height,this.radius)
    for(let i=0;i<source.length;i+=4){ source[i]=Math.min(255,(source[i]??0)+(blurred[i]??0)*255*this.intensity); source[i+1]=Math.min(255,(source[i+1]??0)+(blurred[i+1]??0)*255*this.intensity); source[i+2]=Math.min(255,(source[i+2]??0)+(blurred[i+2]??0)*255*this.intensity) }
    return frame
  }
}

export function toneMapColor(color: readonly [number,number,number], mode: ToneMappingMode='aces', exposure=1): [number,number,number] { return [tone(color[0]*exposure,mode),tone(color[1]*exposure,mode),tone(color[2]*exposure,mode)] }
function tone(value:number,mode:ToneMappingMode):number { if(mode==='linear')return clamp(value,0,1); if(mode==='reinhard')return value/(1+value); if(mode==='neutral'){let x=Math.max(0,value);if(x<0.08)x=Math.max(0,x-6.25*x*x);else x=Math.max(0,x-0.04);const start=0.76;if(x<start)return clamp(x,0,1);const d=1-start;return clamp(1-d*d/(x+d-start),0,1)} const a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((value*(a*value+b))/(value*(c*value+d)+e),0,1) }
function toByte(value:number,gamma:number):number { return Math.round(Math.pow(clamp(value,0,1),1/gamma)*255) }
function boxBlur(source:Float32Array,target:Float32Array,width:number,height:number,radius:number):void { const temp=new Float32Array(source.length); blurAxis(source,temp,width,height,radius,true); blurAxis(temp,target,width,height,radius,false) }
function blurAxis(source:Float32Array,target:Float32Array,width:number,height:number,radius:number,horizontal:boolean):void { for(let y=0;y<height;y++)for(let x=0;x<width;x++){let r=0,g=0,b=0,count=0;for(let k=-radius;k<=radius;k++){const px=horizontal?x+k:x,py=horizontal?y:y+k;if(px<0||px>=width||py<0||py>=height)continue;const i=(py*width+px)*4;r+=source[i]??0;g+=source[i+1]??0;b+=source[i+2]??0;count++}const out=(y*width+x)*4;target[out]=r/count;target[out+1]=g/count;target[out+2]=b/count} }
function clamp(value:number,minimum:number,maximum:number):number{return Math.max(minimum,Math.min(maximum,value))}
