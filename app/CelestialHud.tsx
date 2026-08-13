"use client";

import { compassPoint, type CelestialState, type CelestialTime } from "./celestial";
import MoonPhaseSwatch from "./MoonPhaseSwatch";

type CelestialBodyKind = "sun" | "moon";

type Props = {
  celestial: CelestialState;
  bodyKind: CelestialBodyKind;
  time: CelestialTime;
  scenarioDate: string;
  viewHeading: number;
  currentPhaseContentActive: boolean;
  opticalAppearance: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CelestialHud({
  celestial,
  bodyKind,
  time,
  scenarioDate,
  viewHeading,
  currentPhaseContentActive,
  opticalAppearance,
  open,
  onOpenChange,
}: Props) {
  const activeBody = celestial[bodyKind];
  const bodyLabel = bodyKind === "moon" ? "Moon" : "Sun";
  const relativeBearing = ((activeBody.azimuth - viewHeading + 540) % 360) - 180;
  const turnMagnitude = Math.round(Math.abs(relativeBearing));
  const turnInstruction = turnMagnitude <= 3
    ? "ON CURRENT BEARING"
    : `TURN ${relativeBearing > 0 ? "RIGHT" : "LEFT"} ${turnMagnitude}°`;
  const clock = time === "dawn" ? "06:00" : time === "day" ? "13:00" : time === "dusk" ? "18:00" : "23:00";
  const observerText = `${Math.abs(celestial.observer.latitude)}°${celestial.observer.latitude < 0 ? "S" : "N"}, ${Math.abs(celestial.observer.longitude)}°${celestial.observer.longitude < 0 ? "W" : "E"}`;
  const illumination = bodyKind === "moon" ? `; ${Math.round(celestial.moon.illumination * 100)} percent illuminated` : "";
  const description = `${bodyLabel} altitude ${Math.round(activeBody.altitude)} degrees; azimuth ${Math.round(activeBody.azimuth)} degrees ${compassPoint(activeBody.azimuth)}; ${activeBody.aboveHorizon ? "above" : "below"} the horizon${illumination}. ${opticalAppearance}. ${scenarioDate} at ${clock} local time. Observer ${observerText}.${activeBody.aboveHorizon ? "" : ` ${turnInstruction}.`}`;

  return (
    <>
      <span id="sky-model-note" className="visually-hidden">{description}</span>

      <div
        className="sky-readout"
        data-expanded={open ? "true" : "false"}
        data-current-phase={currentPhaseContentActive ? "true" : "false"}
        role="group"
        aria-label={`${bodyLabel} position recap`}
      >
        <button
          className="sky-readout-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={open ? "sky-readout-details" : undefined}
          aria-label={`${open ? "Close" : "Show"} ${bodyLabel} position recap`}
          onClick={() => onOpenChange(!open)}
        >
          {bodyKind === "moon"
            ? <MoonPhaseSwatch phaseAngle={celestial.moon.phaseAngle} southernHemisphere={celestial.observer.latitude < 0} size="compact" />
            : <i className="low-poly-swatch sun" aria-hidden="true" />}
          <span className="sky-readout-label-long">{bodyLabel.toUpperCase()} {activeBody.aboveHorizon ? "POSITION" : "BELOW"}</span>
          <span className="sky-readout-label-short">SKY DATA</span>
          <b aria-hidden="true">{open ? "−" : "+"}</b>
        </button>

        {open && (
          <div id="sky-readout-details" className="sky-readout-details">
            <div className="sky-mini" aria-hidden="true">
              <span>N</span><span>E</span><span>S</span><span>W</span><span>N</span>
              <i />
              <b
                className={`${activeBody.aboveHorizon ? "" : "below"}${celestial.observer.latitude < 0 ? " southern" : ""}`}
                style={{ left: `${(activeBody.azimuth / 360) * 100}%`, bottom: `${Math.max(3, Math.min(91, (activeBody.altitude / 90) * 88 + 3))}%` }}
              >{bodyKind === "moon"
                ? <MoonPhaseSwatch phaseAngle={celestial.moon.phaseAngle} southernHemisphere={celestial.observer.latitude < 0} size="compact" />
                : <i className="low-poly-swatch sun" />}</b>
            </div>
            {bodyKind === "moon" && <MoonPhaseSwatch phaseAngle={celestial.moon.phaseAngle} southernHemisphere={celestial.observer.latitude < 0} size="detail" />}
            <div className="sky-readout-copy">
              <strong>{bodyKind === "moon" ? celestial.moon.phaseName : bodyLabel}</strong>
              <span>{bodyLabel} altitude {Math.round(activeBody.altitude)}° · azimuth {Math.round(activeBody.azimuth)}° {compassPoint(activeBody.azimuth)} · {activeBody.aboveHorizon ? "above" : "below"} horizon{bodyKind === "moon" ? ` · ${Math.round(celestial.moon.illumination * 100)}% lit` : ""}</span>
              <span>{opticalAppearance}</span>
              {!activeBody.aboveHorizon && <span className="sky-direction"><b aria-hidden="true" style={{ transform: `rotate(${relativeBearing}deg)` }}>↑</b>{turnInstruction}</span>}
              <small>{scenarioDate} · {clock} local time · observer {observerText}</small>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
