import type { Camera } from '@sekai64-internal/cameras'
import { Box3, Matrix4, Vector3 } from '@sekai64-internal/math'
import { computeShadowCascadeSplits, type RendererShadowOptions, type ShadowCascadeSplit } from './VisualPipeline.js'

export interface DirectionalShadowFrame {
  matrix: Matrix4
  center: Vector3
  radius: number
}

export interface DirectionalShadowCascadeFrame extends DirectionalShadowFrame {
  index: number
  splitNear: number
  splitFar: number
}

/** Builds a stable single-cascade directional-light matrix around visible scene bounds. */
export function createDirectionalShadowFrame(
  bounds: Box3,
  directionInput: readonly [number, number, number] | Vector3,
  padding = 2,
): DirectionalShadowFrame | undefined {
  if (bounds.isEmpty()) return undefined
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const radius = Math.max(0.5, size.length() * 0.5 + Math.max(0, padding))
  return createFrameFromCenterRadius(center, radius, directionInput)
}

/**
 * Creates camera-frustum cascades for directional outdoor shadows.
 * The split scheme is renderer-neutral and the optional texel snapping keeps
 * the orthographic projection stable while the camera moves slowly.
 */
export function createDirectionalShadowCascades(
  camera: Camera,
  directionInput: readonly [number, number, number] | Vector3,
  options: Pick<RendererShadowOptions, 'cascades' | 'maxDistance' | 'splitLambda' | 'cameraPadding' | 'stabilize' | 'mapSize'>,
): readonly DirectionalShadowCascadeFrame[] {
  const cascadeFar = Math.min(camera.far, Math.max(camera.near + 0.001, options.maxDistance))
  const splits = computeShadowCascadeSplits(camera.near, cascadeFar, options.cascades, options.splitLambda)
  const inverseViewProjection = camera.viewProjectionMatrix.clone().invert()
  const nearCorners: Vector3[] = []
  const farCorners: Vector3[] = []
  for (const y of [-1, 1]) for (const x of [-1, 1]) {
    nearCorners.push(new Vector3(x, y, -1).applyMatrix4(inverseViewProjection))
    farCorners.push(new Vector3(x, y, 1).applyMatrix4(inverseViewProjection))
  }
  const fullRange = Math.max(0.001, camera.far - camera.near)
  return splits.map((split, index) => createCascadeFrame(
    index,
    split,
    nearCorners,
    farCorners,
    camera.near,
    fullRange,
    directionInput,
    options,
  ))
}

function createCascadeFrame(
  index: number,
  split: ShadowCascadeSplit,
  nearCorners: readonly Vector3[],
  farCorners: readonly Vector3[],
  cameraNear: number,
  fullRange: number,
  directionInput: readonly [number, number, number] | Vector3,
  options: Pick<RendererShadowOptions, 'cameraPadding' | 'stabilize' | 'mapSize'>,
): DirectionalShadowCascadeFrame {
  const nearAlpha = Math.max(0, Math.min(1, (split.near - cameraNear) / fullRange))
  const farAlpha = Math.max(0, Math.min(1, (split.far - cameraNear) / fullRange))
  const corners: Vector3[] = []
  for (let cornerIndex = 0; cornerIndex < nearCorners.length; cornerIndex += 1) {
    const near = nearCorners[cornerIndex] as Vector3
    const far = farCorners[cornerIndex] as Vector3
    corners.push(near.clone().lerp(far, nearAlpha), near.clone().lerp(far, farAlpha))
  }
  const center = new Vector3()
  for (const corner of corners) center.add(corner)
  center.multiplyScalar(1 / corners.length)
  let radius = 0
  for (const corner of corners) radius = Math.max(radius, center.distanceTo(corner))
  radius = Math.max(0.5, Math.ceil((radius + Math.max(0, options.cameraPadding)) * 16) / 16)
  if (options.stabilize) {
    stabilizeCascadeCenter(center, radius, directionInput, options.mapSize)
  }
  const frame = createFrameFromCenterRadius(center, radius, directionInput)
  if (!frame) throw new Error('Directional shadow cascade requires a non-zero light direction.')
  return { ...frame, index, splitNear: split.near, splitFar: split.far }
}


function stabilizeCascadeCenter(
  center: Vector3,
  radius: number,
  directionInput: readonly [number, number, number] | Vector3,
  mapSize: number,
): void {
  const direction = directionInput instanceof Vector3
    ? directionInput.clone().normalize()
    : new Vector3(...directionInput).normalize()
  if (direction.lengthSquared() < 1e-8) return

  // Snap in the light's projection plane, not world XYZ. World-axis snapping
  // still lets the orthographic shadow texel grid slide when the sun is angled,
  // which shows up as camera-relative "swimming" while the player moves.
  const lightZ = direction.multiplyScalar(-1)
  const up = Math.abs(lightZ.y) > 0.98 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const lightX = up.clone().cross(lightZ).normalize()
  if (lightX.lengthSquared() < 1e-8) lightX.set(1, 0, 0)
  const lightY = lightZ.clone().cross(lightX).normalize()
  const worldUnitsPerTexel = (radius * 2) / Math.max(64, mapSize)
  const lightXPosition = lightX.dot(center)
  const lightYPosition = lightY.dot(center)
  const snappedX = Math.round(lightXPosition / worldUnitsPerTexel) * worldUnitsPerTexel
  const snappedY = Math.round(lightYPosition / worldUnitsPerTexel) * worldUnitsPerTexel
  center
    .addScaledVector(lightX, snappedX - lightXPosition)
    .addScaledVector(lightY, snappedY - lightYPosition)
}

function createFrameFromCenterRadius(
  center: Vector3,
  radius: number,
  directionInput: readonly [number, number, number] | Vector3,
): DirectionalShadowFrame | undefined {
  const direction = directionInput instanceof Vector3
    ? directionInput.clone().normalize()
    : new Vector3(...directionInput).normalize()
  if (direction.lengthSquared() < 1e-8) return undefined
  const eye = center.clone().addScaledVector(direction, -radius * 2)
  const up = Math.abs(direction.y) > 0.98 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const view = makeLookAtView(eye, center, up)
  const projection = new Matrix4().makeOrthographic(-radius, radius, radius, -radius, 0.1, radius * 4.5)
  return { matrix: projection.multiply(view), center, radius }
}

function makeLookAtView(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
  const z = eye.clone().sub(target).normalize()
  const x = up.clone().cross(z).normalize()
  if (x.lengthSquared() < 1e-8) x.set(1, 0, 0)
  const y = z.clone().cross(x).normalize()
  return new Matrix4().set(
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -x.dot(eye), -y.dot(eye), -z.dot(eye), 1,
  )
}
