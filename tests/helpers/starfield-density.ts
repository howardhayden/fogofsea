/** Release-fixture reference: the existing 1280 x 720 desktop viewport has
 * a 72 CSS-pixel header and a 42-degree vertical perspective field of view.
 * This is test-only geometry, not an application quality or density setting.
 */
export const STARFIELD_DENSITY_REFERENCE = Object.freeze({
  width: 1280,
  height: 648,
  verticalFovDegrees: 42,
  minimumPinpoints: 300,
});

/** Solid angle of a rectangular perspective frustum, in steradians.
 * A portrait view has a smaller horizontal field, not a smaller vertical FOV.
 */
export function perspectiveSolidAngle(width: number, height: number, verticalFovDegrees: number): number {
  if (![width, height].every((value) => Number.isSafeInteger(value) && value > 0)
    || !Number.isFinite(verticalFovDegrees) || verticalFovDegrees <= 0 || verticalFovDegrees >= 180) {
    throw new RangeError("A finite positive viewport and a vertical FOV between 0 and 180 degrees are required");
  }
  const verticalHalfAngle = verticalFovDegrees * Math.PI / 360;
  const horizontalHalfAngle = Math.atan(width / height * Math.tan(verticalHalfAngle));
  return 4 * Math.asin(Math.sin(horizontalHalfAngle) * Math.sin(verticalHalfAngle));
}

/** Compare a measured feature density, not unequal slices of the same sky. */
export function referenceFieldCount(
  count: number,
  width: number,
  height: number,
  verticalFovDegrees: number = STARFIELD_DENSITY_REFERENCE.verticalFovDegrees,
): number {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("A nonnegative feature count is required");
  const reference = STARFIELD_DENSITY_REFERENCE;
  const angle = perspectiveSolidAngle(width, height, verticalFovDegrees);
  const referenceAngle = perspectiveSolidAngle(reference.width, reference.height, reference.verticalFovDegrees);
  return count * (referenceAngle / angle);
}

/** Compare the projected area of one local feature at the reference raster.
 * With a fixed perspective camera, local image-plane area scales with the
 * square of focal length in pixels. Horizontal raster extent changes coverage,
 * not the projected size of a feature already in view.
 */
export function referenceProjectedArea(
  area: number,
  height: number,
  verticalFovDegrees: number = STARFIELD_DENSITY_REFERENCE.verticalFovDegrees,
): number {
  if (!Number.isSafeInteger(area) || area < 0) throw new RangeError("A nonnegative pixel area is required");
  if (!Number.isSafeInteger(height) || height <= 0
    || !Number.isFinite(verticalFovDegrees) || verticalFovDegrees <= 0 || verticalFovDegrees >= 180) {
    throw new RangeError("A positive raster height and a vertical FOV between 0 and 180 degrees are required");
  }
  const focalLength = height / (2 * Math.tan(verticalFovDegrees * Math.PI / 360));
  const reference = STARFIELD_DENSITY_REFERENCE;
  const referenceFocalLength = reference.height
    / (2 * Math.tan(reference.verticalFovDegrees * Math.PI / 360));
  return area * (referenceFocalLength / focalLength) ** 2;
}

/** Preserve the named pinpoint contract and its strict original desktop floor. */
export function referenceFieldPinpoints(
  pinpoints: number,
  width: number,
  height: number,
  verticalFovDegrees: number = STARFIELD_DENSITY_REFERENCE.verticalFovDegrees,
): number {
  return referenceFieldCount(pinpoints, width, height, verticalFovDegrees);
}
