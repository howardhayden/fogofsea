/** Canonical three-band star shimmer. Both rendering paths use these exact
 * coefficients; movement-linked unit glow reuses the same waveform. */
export const STAR_SHIMMER_MODEL = Object.freeze({
  tau: 6.28318530718,
  irregularFrequency: 0.613,
  crystallineFrequency: 1.731,
  irregularPhase: 1.71,
  crystallinePhase: 0.47,
  primaryWeight: 0.55,
  irregularWeight: 0.28,
  crystallineWeight: 0.17,
});

export function sampleStarShimmer(elapsed: number, phase: number, frequency: number): number {
  if (![elapsed, phase, frequency].every(Number.isFinite)) return 0;
  const model = STAR_SHIMMER_MODEL;
  const primary = Math.sin(elapsed * model.tau * frequency + phase);
  const irregular = Math.sin(elapsed * model.tau * frequency * model.irregularFrequency + phase * model.irregularPhase);
  const crystalline = Math.sin(elapsed * model.tau * frequency * model.crystallineFrequency + phase * model.crystallinePhase);
  return primary * model.primaryWeight + irregular * model.irregularWeight + crystalline * model.crystallineWeight;
}

/** The original shader's operation order and decimal literals are preserved. */
export const STAR_SHIMMER_GLSL = `
      float sampleStarShimmer(float elapsed, float phase, float frequency) {
        float primary = sin(elapsed * ${STAR_SHIMMER_MODEL.tau} * frequency + phase);
        float irregular = sin(elapsed * ${STAR_SHIMMER_MODEL.tau} * frequency * ${STAR_SHIMMER_MODEL.irregularFrequency} + phase * ${STAR_SHIMMER_MODEL.irregularPhase});
        float crystalline = sin(elapsed * ${STAR_SHIMMER_MODEL.tau} * frequency * ${STAR_SHIMMER_MODEL.crystallineFrequency} + phase * ${STAR_SHIMMER_MODEL.crystallinePhase});
        return primary * ${STAR_SHIMMER_MODEL.primaryWeight} + irregular * ${STAR_SHIMMER_MODEL.irregularWeight} + crystalline * ${STAR_SHIMMER_MODEL.crystallineWeight};
      }
`;
