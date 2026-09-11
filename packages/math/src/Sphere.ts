import { Vector3 } from './Vector3.js'
export class Sphere { readonly center = new Vector3(); constructor(center?: Vector3, public radius = -1) { if (center) this.center.copy(center) } }
