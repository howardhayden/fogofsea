import type { KeyboardEventHandler, RefObject } from "react";
import type { Difficulty } from "./gameModel";

type BrowserSaveSummary = {
  id: string;
  name: string;
  updatedAt: string;
  operation: string;
  exercise: number;
};

const DIFFICULTIES: Array<{ id: Difficulty; label: string; detail: string }> = [
  { id: "guided", label: "Guided", detail: "A repeatable first scenario, next-action checklist, gentler pressure, and reversible turns." },
  { id: "standard", label: "Standard", detail: "Full planning standards, ordinary pressure, and possible disclosed disruption or secondary objectives." },
  { id: "challenge", label: "Challenge", detail: "Adverse-weighted matrices can combine cooperating opponents, severe disruption, command constraints, and emerging objectives." },
];

type PrivacyGateProps = {
  hydrated: boolean;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  saveName: string;
  onSaveNameChange: (name: string) => void;
  saveWrittenAnalysis: boolean;
  onSaveWrittenAnalysisChange: (include: boolean) => void;
  savedSlots: BrowserSaveSummary[];
  status: string;
  sessionButtonRef: RefObject<HTMLButtonElement | null>;
  onBeginSession: () => void;
  onBeginSaved: () => void;
  onLoad: (slot: BrowserSaveSummary) => void;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
};

export default function PrivacyGate({
  hydrated,
  difficulty,
  onDifficultyChange,
  saveName,
  onSaveNameChange,
  saveWrittenAnalysis,
  onSaveWrittenAnalysisChange,
  savedSlots,
  status,
  sessionButtonRef,
  onBeginSession,
  onBeginSaved,
  onLoad,
  onKeyDown,
}: PrivacyGateProps) {
  return (
    <div className="modal-backdrop privacy-backdrop" role="presentation">
      <section className="privacy-gate" role="dialog" aria-modal="true" aria-labelledby="privacy-title" aria-describedby="privacy-description" tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="privacy-heading"><span>PRIVACY BEFORE PLAY · LOCAL BUILD 2026-08-11-VSCODIUM-13</span><h2 id="privacy-title">HOW SHOULD THIS GAME REMEMBER YOU?</h2></div>
        <p id="privacy-description">Choose before beginning. There is no account, gameplay telemetry, advertising, or server save. A restrictive security policy blocks third-party scripts, frames, images, fonts, and network connections. A hosting provider may still receive ordinary request metadata while serving the page; the app sends it no game decisions or saved data.</p>
        <fieldset className="difficulty-picker">
          <legend>CHOOSE A PLAY MODE</legend>
          {DIFFICULTIES.map((mode) => (
            <label key={mode.id} className={difficulty === mode.id ? "selected" : ""}>
              <input type="radio" name="difficulty" value={mode.id} checked={difficulty === mode.id} onChange={() => onDifficultyChange(mode.id)} />
              <span><strong>{mode.label}</strong><small>{mode.detail}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="privacy-choices">
          <div role="group" aria-labelledby="session-only-title">
            <strong id="session-only-title">SESSION ONLY</strong>
            <p>Write nothing new to browser storage. You can still download and import portable TXT saves.</p>
            <button ref={sessionButtonRef} type="button" disabled={!hydrated} onClick={onBeginSession}>PLAY WITHOUT BROWSER SAVING</button>
          </div>
          <div role="group" aria-labelledby="browser-save-title">
            <strong id="browser-save-title">SAVE IN THIS BROWSER</strong>
            <p>Create a named, device-local game. By default, the resumable game state is saved but your free-form writing is not.</p>
            <label htmlFor="pregame-save-name">GAME NAME</label>
            <input id="pregame-save-name" value={saveName} maxLength={60} autoComplete="off" onChange={(event) => onSaveNameChange(event.target.value)} />
            <label className="privacy-analysis-choice">
              <input type="checkbox" checked={saveWrittenAnalysis} onChange={(event) => onSaveWrittenAnalysisChange(event.target.checked)} />
              <span><strong>Include my written analysis</strong><small>Stores rationale, assumptions, synthesis, and termination notes as readable text in this browser profile.</small></span>
            </label>
            <button type="button" disabled={!hydrated || !saveName.trim()} onClick={onBeginSaved}>ENABLE SAVING &amp; BEGIN</button>
          </div>
        </div>
        <div className="saved-game-picker">
          <div><h3>SAVED GAMES ON THIS BROWSER</h3><span>{savedSlots.length}</span></div>
          <div className="saved-game-scroll" role="list" aria-label="Saved browser games">
            {savedSlots.length ? savedSlots.map((slot) => (
              <article key={slot.id} role="listitem">
                <button type="button" onClick={() => onLoad(slot)} aria-label={`Load ${slot.name}: ${slot.operation}, exercise ${slot.exercise}`}>
                  <span><strong>{slot.name}</strong><small>{slot.operation} · Exercise {String(slot.exercise).padStart(2, "0")}</small></span>
                  <time dateTime={slot.updatedAt}>{new Date(slot.updatedAt).toLocaleString()}</time>
                </button>
              </article>
            )) : <p>No browser-saved games yet.</p>}
          </div>
        </div>
        <p className="privacy-status" role="status" aria-live="polite">{status}</p>
      </section>
    </div>
  );
}
