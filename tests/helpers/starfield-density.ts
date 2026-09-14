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

/** Compare the measured glint density, not unequal slices of the same sky.
 * The original desktop threshold (strictly more than 300) is unchanged.
 */
export function referenceFieldPinpoints(
  pinpoints: number,
  width: number,
  height: number,
  verticalFovDegrees: number = STARFIELD_DENSITY_REFERENCE.verticalFovDegrees,
): number {
  if (!Number.isSafeInteger(pinpoints) || pinpoints < 0) throw new RangeError("Pinpoints must be a nonnegative count");
  const reference = STARFIELD_DENSITY_REFERENCE;
  const angle = perspectiveSolidAngle(width, height, verticalFovDegrees);
  const referenceAngle = perspectiveSolidAngle(reference.width, reference.height, reference.verticalFovDegrees);
  return pinpoints * (referenceAngle / angle);
}
