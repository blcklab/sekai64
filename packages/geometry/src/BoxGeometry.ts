import { Geometry } from './Geometry.js'

export interface BoxGeometryOptions {
  width?: number
  height?: number
  depth?: number
  label?: string
}

export class BoxGeometry extends Geometry {
  constructor(options: BoxGeometryOptions = {}) {
    const width = options.width ?? 1
    const height = options.height ?? 1
    const depth = options.depth ?? 1
    if (width <= 0 || height <= 0 || depth <= 0) throw new Error('BoxGeometry dimensions must be greater than zero.')
    const x = width / 2, y = height / 2, z = depth / 2
    const positions = new Float32Array([
      -x,-y, z, x,-y, z, x, y, z, -x, y, z,
       x,-y,-z,-x,-y,-z,-x, y,-z, x, y,-z,
      -x, y, z, x, y, z, x, y,-z,-x, y,-z,
      -x,-y,-z, x,-y,-z, x,-y, z,-x,-y, z,
       x,-y, z, x,-y,-z, x, y,-z, x, y, z,
      -x,-y,-z,-x,-y, z,-x, y, z,-x, y,-z
    ])
    const normals = new Float32Array([
      0,0,1, 0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0, 0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
      1,0,0, 1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0
    ])
    const uvs = new Float32Array([
      0,0,1,0,1,1,0,1, 0,0,1,0,1,1,0,1,
      0,0,1,0,1,1,0,1, 0,0,1,0,1,1,0,1,
      0,0,1,0,1,1,0,1, 0,0,1,0,1,1,0,1
    ])
    const indices = new Uint16Array([
      0,1,2,0,2,3, 4,5,6,4,6,7,
      8,9,10,8,10,11, 12,13,14,12,14,15,
      16,17,18,16,18,19, 20,21,22,20,22,23
    ])
    super({ positions, normals, uvs, indices }, options.label)
  }
}
