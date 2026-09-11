import type { Disposable } from '@sekai64-internal/core'

export interface PostProcessContext<TFrame> { frame: TFrame; width: number; height: number; deltaTime: number }
export interface PostProcessPass<TFrame> extends Partial<Disposable> { readonly name: string; enabled: boolean; process(context: PostProcessContext<TFrame>): TFrame | Promise<TFrame> }

export class PostProcessGraph<TFrame> implements Disposable {
  disposed = false
  readonly passes: PostProcessPass<TFrame>[] = []
  add(...passes: readonly PostProcessPass<TFrame>[]): this { this.assertAlive(); this.passes.push(...passes); return this }
  remove(pass: PostProcessPass<TFrame>): boolean { const index=this.passes.indexOf(pass); if(index<0)return false; this.passes.splice(index,1); return true }
  async process(frame: TFrame, width: number, height: number, deltaTime = 0): Promise<TFrame> {
    this.assertAlive(); let output=frame
    for (const pass of this.passes) if (pass.enabled) output=await pass.process({frame:output,width,height,deltaTime})
    return output
  }
  dispose(): void { if(this.disposed)return; this.disposed=true; for(const pass of this.passes) pass.dispose?.(); this.passes.length=0 }
  private assertAlive(): void { if(this.disposed)throw new Error('PostProcessGraph is disposed.') }
}
