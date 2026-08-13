import { useCallback, useEffect, useState } from "react";
import {
  clearBrowserSaves,
  createSlotId,
  deleteBrowserSave,
  readBrowserSave,
  readSaveIndex,
  resolveWrittenAnalysisPolicy,
  writeBrowserSave,
  type SaveSlotMeta,
} from "./browserSaves";
import type { PortableSave } from "./saveGame";
import { sanitizeSaveName } from "./inputSecurity";

export type StorageMode = "undecided" | "enabled" | "disabled";

type BrowserSaveManagerOptions = {
  hydrated: boolean;
  buildSave: () => PortableSave;
};

export type LoadedBrowserSave = {
  save: PortableSave;
  includeWrittenAnalysis: boolean;
};

export function useBrowserSaveManager({ hydrated, buildSave }: BrowserSaveManagerOptions) {
  const [mode, setMode] = useState<StorageMode>("undecided");
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => typeof window === "undefined" ? [] : readSaveIndex());
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [name, setName] = useState("New campaign");
  const [includeWrittenAnalysis, setIncludeWrittenAnalysis] = useState(false);
  const [status, setStatus] = useState("Choose a privacy mode before play.");

  useEffect(() => {
    if (!hydrated || mode !== "enabled" || !activeSlotId) return;
    const timer = window.setTimeout(() => {
      setStatus("Saving changes to this browser…");
      try {
        const written = writeBrowserSave({
          slotId: activeSlotId,
          name,
          save: buildSave(),
          includeWrittenAnalysis,
        });
        setSlots(written.index);
        setStatus("Saved to the active browser game.");
      } catch {
        setStatus("Browser saving failed. Download a TXT copy to preserve this game.");
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [hydrated, mode, activeSlotId, name, includeWrittenAnalysis, buildSave]);

  useEffect(() => {
    if (!hydrated || mode !== "enabled" || !activeSlotId) return;
    const flush = () => {
      try {
        writeBrowserSave({
          slotId: activeSlotId,
          name,
          save: buildSave(),
          includeWrittenAnalysis,
        });
      } catch {
        // The visible debounced path reports storage failures while the page is active.
      }
    };
    const flushWhenHidden = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [hydrated, mode, activeSlotId, name, includeWrittenAnalysis, buildSave]);

  const beginSessionOnly = useCallback(() => {
    setMode("disabled");
    setActiveSlotId(null);
    setStatus("Browser saving is off. TXT export remains available.");
  }, []);

  const enableNewSlot = useCallback((nameOverride?: string) => {
    const id = createSlotId();
    setActiveSlotId(id);
    setMode("enabled");
    setName(sanitizeSaveName(nameOverride ?? name).trim() || "New campaign");
    setStatus("Browser saving enabled for a new game.");
    return id;
  }, [name]);

  const loadSlot = useCallback((slot: SaveSlotMeta): LoadedBrowserSave | null => {
    try {
      const save = readBrowserSave(slot.id);
      const policy = resolveWrittenAnalysisPolicy(slot, save);
      setActiveSlotId(slot.id);
      setName(sanitizeSaveName(slot.name));
      setIncludeWrittenAnalysis(policy);
      setMode("enabled");
      setStatus(`Loaded ${slot.name}. Written analysis ${policy ? "will remain included" : "remains excluded"} in this slot.`);
      return { save, includeWrittenAnalysis: policy };
    } catch (error) {
      setStatus(error instanceof Error ? `Could not load game: ${error.message}` : "Could not load this browser game.");
      return null;
    }
  }, []);

  const disableSaving = useCallback(() => {
    setMode("disabled");
    setActiveSlotId(null);
    setStatus("Browser saving is off. Existing saved games were left untouched.");
  }, []);

  const removeSlot = useCallback((slot: SaveSlotMeta) => {
    try {
      setSlots(deleteBrowserSave(slot.id));
      if (activeSlotId === slot.id) {
        setMode("disabled");
        setActiveSlotId(null);
      }
      setStatus(`Deleted ${slot.name} from this browser.`);
      return true;
    } catch {
      setStatus("This browser did not allow the saved game to be deleted.");
      return false;
    }
  }, [activeSlotId]);

  const createImportedSlot = useCallback((operation: string, filename: string) => {
    if (mode !== "enabled") {
      setStatus(`Imported ${filename} for this session only.`);
      return null;
    }
    const id = createSlotId();
    setActiveSlotId(id);
    setName(sanitizeSaveName(`${operation} import`));
    setStatus(`Imported ${sanitizeSaveName(filename)} as a new browser game.`);
    return id;
  }, [mode]);

  const resetAll = useCallback(() => {
    clearBrowserSaves();
    setMode("undecided");
    setActiveSlotId(null);
    setSlots([]);
    setName("New campaign");
    setIncludeWrittenAnalysis(false);
    setStatus("All browser save data reset. Choose a privacy mode to begin.");
  }, []);

  return {
    mode,
    slots,
    activeSlotId,
    name,
    includeWrittenAnalysis,
    status,
    setName: (value: string) => setName(sanitizeSaveName(value)),
    setIncludeWrittenAnalysis,
    reportStatus: setStatus,
    beginSessionOnly,
    enableNewSlot,
    loadSlot,
    disableSaving,
    removeSlot,
    createImportedSlot,
    resetAll,
  };
}
