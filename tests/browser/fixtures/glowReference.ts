// Exact v4 shader retained as the independent pixel-equivalence reference.
// This browser-only fixture is excluded from the application build.
import { DREAM_GLOW_TAPS } from "../../../app/dreamGlowMath";

const DEPTH_FUNCTION = `
  float viewDepth(float d, vec2 nearFar) {
    return nearFar.x * nearFar.y / (nearFar.y - d * (nearFar.y - nearFar.x));
  }
  bool blocked(float source, float destination, vec2 nearFar) {
    float z = viewDepth(source, nearFar);
    return z > viewDepth(destination, nearFar) + max(0.0001, z * 0.00001);
  }
`;
export const UNOPTIMIZED_GLOW_FRAGMENT = `
  precision highp float;
  uniform sampler2D uEmission;
  uniform sampler2D uSourceDepth;
  uniform sampler2D uSceneDepth;
  uniform vec2 uFullSize;
  uniform vec2 uSourceSize;
  uniform vec2 uNearFar;
  uniform vec4 uCaptureRect;
  uniform float uReference;
  uniform float uGain;
  uniform vec4 uSourceBounds;
  uniform vec3 uSigmaRatios;
  uniform vec3 uWeights;
  uniform vec3 uTaps[${DREAM_GLOW_TAPS.length}];
  ${DEPTH_FUNCTION}
  vec4 sourceAt(vec2 uv) {
    vec2 limit = uCaptureRect.zw / uSourceSize;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThanEqual(uv, limit))) return vec4(0.0);
    return texture2D(uEmission, uv);
  }
  void main() {
    vec2 fullUv = gl_FragCoord.xy / uFullSize;
    vec2 centerUv = (gl_FragCoord.xy - uCaptureRect.xy) / uSourceSize;
    float destinationDepth = texture2D(uSceneDepth, fullUv).r;
    float coverage = sourceAt(centerUv).a;
    // The final composite discards every halo contribution at an opaque core.
    // Preserve that mask but do not evaluate 327 samples that cannot be shown.
    if (coverage >= 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, coverage);
      return;
    }
    vec3 spread = vec3(0.0);
    for (int scaleIndex = 0; scaleIndex < 3; scaleIndex++) {
      float radius = uReference * uSigmaRatios[scaleIndex];
      // A conservative projected source rectangle plus the exact finite
      // kernel support. The two-pixel source margin includes raster/filter edges.
      float support = 3.0 * radius;
      if (any(lessThan(gl_FragCoord.xy, uSourceBounds.xy - support)) ||
          any(greaterThan(gl_FragCoord.xy, uSourceBounds.zw + support))) continue;
      vec2 sigma = radius / uSourceSize;
      for (int tapIndex = 0; tapIndex < ${DREAM_GLOW_TAPS.length}; tapIndex++) {
        vec3 tap = uTaps[tapIndex];
        vec2 sampleUv = centerUv + tap.xy * sigma;
        vec4 source = sourceAt(sampleUv);
        if (source.a <= 0.0) continue;
        if (blocked(texture2D(uSourceDepth, sampleUv).r, destinationDepth, uNearFar)) continue;
        // No post-occlusion renormalization: blocked light disappears.
        spread += source.rgb * (tap.z * uWeights[scaleIndex]);
      }
    }
    gl_FragColor = vec4(spread * uGain, coverage);
  }
`;
