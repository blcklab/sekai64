import { describe, expect, it } from 'vitest'
import { Euler, Matrix4, Vector3 } from './index.js'

describe('Vector3', () => {
  it('normalizes vectors', () => {
    const vector = new Vector3(3, 0, 4).normalize()
    expect(vector.length()).toBeCloseTo(1)
    expect(vector.x).toBeCloseTo(0.6)
  })
})

describe('Matrix4', () => {
  it('composes and inverts a transform', () => {
    const matrix = new Matrix4().compose(new Vector3(2, 3, 4), new Euler(), new Vector3(1, 1, 1))
    const point = new Vector3(1, 1, 1).applyMatrix4(matrix).applyMatrix4(matrix.clone().invert())
    expect(point.equals(new Vector3(1, 1, 1), 1e-5)).toBe(true)
  })
})
