import { Geometry } from './Geometry.js'

export interface PlaneGeometryOptions { width?: number; height?: number; label?: string }

export class PlaneGeometry extends Geometry {
  constructor(options: PlaneGeometryOptions = {}) {
    const width = options.width ?? 1, height = options.height ?? 1
    const x = width / 2, y = height / 2
    super({
      positions: new Float32Array([-x,-y,0, x,-y,0, x,y,0, -x,y,0]),
      normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]),
      uvs: new Float32Array([0,0,1,0,1,1,0,1]),
      indices: new Uint16Array([0,1,2,0,2,3])
    }, options.label)
  }
}
