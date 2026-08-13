/** Returns the greatest invented nautical-mile value in a catalog range label. */
export function largestInventedDistance(value: string) {
  return Math.max(...(value.match(/\d+(?:\.\d+)?/gu)?.map(Number) ?? [0]));
}
