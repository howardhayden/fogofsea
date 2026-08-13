"use client";

import { useId } from "react";
import { moonIlluminatedPath } from "./celestial";

type Props = {
  phaseAngle: number;
  southernHemisphere: boolean;
  size: "compact" | "detail";
};

/** A transparent lunar phase glyph: only illuminated facets are emitted. */
export default function MoonPhaseSwatch({ phaseAngle, southernHemisphere, size }: Props) {
  const clipId = `moon-lit-${useId().replaceAll(":", "")}`;
  const path = moonIlluminatedPath(phaseAngle, southernHemisphere);
  const normalized = ((phaseAngle % 360) + 360) % 360;
  const waxing = normalized > 0 && normalized < 180;

  return (
    <svg
      className={`${size === "detail" ? "phase-swatch" : "low-poly-swatch"} moon-phase-swatch ${waxing ? "waxing" : "waning"}`}
      viewBox="-1.08 -1.08 2.16 2.16"
      aria-hidden="true"
      focusable="false"
      data-dark-side="transparent"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="-1.08" y="-1.08" width="2.16" height="2.16" className="moon-phase-base" />
        <path d="M-1.05 -.2 L-.08 -1.08 L.12 .08 L-.72 .62 Z" className="moon-phase-facet cool" />
        <path d="M-.08 -1.08 L1.08 -.46 L.12 .08 Z" className="moon-phase-facet bright" />
        <path d="M.12 .08 L1.08 -.46 L.8 1.08 L-.18 .76 Z" className="moon-phase-facet pearl" />
      </g>
    </svg>
  );
}
