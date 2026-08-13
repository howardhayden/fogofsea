import { useRef, type KeyboardEvent, type RefObject } from "react";
import type { SaveSlotMeta } from "./browserSaves";
import type { DecisionRecord } from "./saveGame";
import type { StorageMode } from "./useBrowserSaveManager";

type SaveManagerProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  backgroundInert: boolean;
  storageMode: StorageMode;
  saveName: string;
  includeWrittenAnalysis: boolean;
  status: string;
  operation: string;
  exercise: number;
  history: DecisionRecord[];
  activeSlotId: string | null;
  slots: SaveSlotMeta[];
  onClose: () => void;
  onDialogKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onSaveNameChange: (value: string) => void;
  onIncludeWrittenAnalysisChange: (value: boolean) => void;
  onDisableSaving: () => void;
  onEnableSaving: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onNewGame: () => void;
  onLoad: (slot: SaveSlotMeta) => void;
  onDelete: (slot: SaveSlotMeta) => void;
  onResetAll: () => void;
};

export default function SaveManager({
  headingRef,
  backgroundInert,
  storageMode,
  saveName,
  includeWrittenAnalysis,
  status,
  operation,
  exercise,
  history,
  activeSlotId,
  slots,
  onClose,
  onDialogKeyDown,
  onSaveNameChange,
  onIncludeWrittenAnalysisChange,
  onDisableSaving,
  onEnableSaving,
  onExport,
  onImport,
  onNewGame,
  onLoad,
  onDelete,
  onResetAll,
}: SaveManagerProps) {
  const importInput = useRef<HTMLInputElement>(null);

  return (
    <div className="modal-backdrop" role="presentation" inert={backgroundInert ? true : undefined} aria-hidden={backgroundInert ? true : undefined} onMouseDown={onClose}>
      <section className="data-dialog" role="dialog" aria-modal="true" aria-labelledby="data-title" aria-describedby="data-privacy-note" tabIndex={-1} onKeyDown={onDialogKeyDown} onMouseDown={(event) => event.stopPropagation()}>
        <div className="guide-header"><div><span>DEVICE-LOCAL SAVE SYSTEM</span><h2 ref={headingRef} id="data-title" tabIndex={-1}>SAVE, LOAD &amp; ANALYZE</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Close save and load panel">×</button></div>
        <div id="data-privacy-note" className="local-data-note"><strong>NO ACCOUNT · NO SERVER SAVE · NO TRACKERS</strong><p>{storageMode === "enabled" ? `Browser saving is on for “${saveName}.” ${includeWrittenAnalysis ? "Free-form writing is included." : "Free-form writing is excluded by default."}` : "Browser saving is off. Nothing from this session is written to browser storage."} Browser data is unencrypted and may be readable by anyone with access to this browser profile. Import and export are processed on your device.</p></div>
        <div className="save-summary">
          <div><span>CURRENT GAME</span><strong>{operation}</strong><small>Exercise {String(exercise).padStart(2, "0")}</small></div>
          <div><span>DECISION RECORDS</span><strong>{history.length}</strong><small>completed results in this game</small></div>
          <div><span>BROWSER MODE</span><strong>{storageMode === "enabled" ? "SAVING ON" : "SAVING OFF"}</strong><small role="status" aria-live="polite">{status}</small></div>
        </div>
        <div className="save-mode-controls" role="group" aria-labelledby="save-mode-title">
          <h3 id="save-mode-title" className="visually-hidden">Browser save settings</h3>
          <label htmlFor="save-game-name">GAME NAME</label>
          <input id="save-game-name" value={saveName} maxLength={60} autoComplete="off" onChange={(event) => onSaveNameChange(event.target.value)} />
          <label className="privacy-analysis-choice">
            <input type="checkbox" checked={includeWrittenAnalysis} onChange={(event) => onIncludeWrittenAnalysisChange(event.target.checked)} />
            <span><strong>Include written analysis in this browser save</strong><small>This choice belongs to the active save slot. Turning it off omits current and historical free-form notes from that slot; TXT downloads always include them.</small></span>
          </label>
          {storageMode === "enabled" ? (
            <button type="button" onClick={onDisableSaving}>DISABLE BROWSER SAVING</button>
          ) : (
            <button type="button" disabled={!saveName.trim()} onClick={onEnableSaving}>ENABLE SAVING FOR THIS GAME</button>
          )}
        </div>
        <div className="save-actions" role="group" aria-label="Portable save and new game actions">
          <button type="button" className="save-primary" onClick={onExport}><span>DOWNLOAD TXT SAVE</span><small>Readable analysis + restorable game data</small></button>
          <button type="button" onClick={() => importInput.current?.click()}><span>IMPORT TXT SAVE</span><small>Restore a file created by this app</small></button>
          <button type="button" onClick={onNewGame}><span>START NEW GAME</span><small>{storageMode === "enabled" ? "Create a separate named browser game" : "Start a fresh session-only game"}</small></button>
          <input
            ref={importInput}
            className="visually-hidden"
            tabIndex={-1}
            type="file"
            accept=".txt,text/plain"
            aria-label="Import FOG OF SEA text save"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onImport(file);
            }}
          />
        </div>
        <p className="save-format-note">The TXT is intentionally human-readable. Keep its final machine-data section intact if you want to import it later.</p>
        <div className="saved-game-picker compact-picker">
          <div><h3>CHOOSE A BROWSER-SAVED GAME</h3><span>{slots.length}</span></div>
          <div className="saved-game-scroll" role="list" aria-label="Saved browser games">
            {slots.length ? slots.map((slot) => (
              <article key={slot.id} role="listitem" className={slot.id === activeSlotId ? "active" : ""}>
                <button type="button" aria-current={slot.id === activeSlotId ? "true" : undefined} onClick={() => onLoad(slot)} aria-label={`Load ${slot.name}: ${slot.operation}, exercise ${slot.exercise}`}>
                  <span><strong>{slot.name}</strong><small>{slot.operation} · Exercise {String(slot.exercise).padStart(2, "0")}</small></span>
                  <time dateTime={slot.updatedAt}>{new Date(slot.updatedAt).toLocaleString()}</time>
                </button>
                <button type="button" className="delete-save" onClick={() => onDelete(slot)} aria-label={`Delete ${slot.name}: ${slot.operation}, exercise ${slot.exercise}`}>DELETE</button>
              </article>
            )) : <p>No browser-saved games yet.</p>}
          </div>
        </div>
        <div className="history-preview">
          <div className="section-title"><span>RECENT DECISIONS</span><i>{history.length}</i></div>
          {history.length ? history.slice(-4).reverse().map((entry) => (
            <article key={entry.id}><div><strong>{entry.operation}</strong><small>{new Date(entry.at).toLocaleString()}</small></div><span>{entry.outcome}</span><b>{entry.score}</b></article>
          )) : <p>No completed decisions yet. Execute a plan to create the first record.</p>}
        </div>
        <div className="reset-zone">
          <button type="button" onClick={onResetAll}>RESET ALL BROWSER DATA</button>
        </div>
      </section>
    </div>
  );
}
