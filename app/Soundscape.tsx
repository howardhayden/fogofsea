"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { SoundProfile } from "./gameModel";

type Props = {
  climate: "ocean" | "arctic" | "antarctic";
  time: "dawn" | "day" | "dusk" | "night";
  precipitation: "none" | "rain" | "snow";
  seaState: number;
  storming: boolean;
  region: string;
  soundProfile: SoundProfile;
  windSpeed: number;
  currentSpeed: number;
  onOpenCredits: () => void;
};

type Environment = Omit<Props, "onOpenCredits">;

export type SoundscapeHandle = {
  openSettings: (opener?: HTMLElement | null) => void;
};

type Graph = {
  context: AudioContext;
  master: GainNode;
  ambience: GainNode;
  effects: GainNode;
  noiseBuffer: AudioBuffer;
  ambienceSources: Set<AudioScheduledSourceNode>;
  effectSources: Set<AudioScheduledSourceNode>;
  environmentKey: string | null;
  timer: number;
};

const PROFILES: Record<SoundProfile, readonly [number, number, number]> = {
  "island-arc": [55, 65.41, 82.41],
  "equatorial-current": [49, 61.74, 73.42],
  "temperate-strait": [58.27, 69.3, 87.31],
  "boreal-ice": [46.25, 58.27, 69.3],
  "polar-archipelago": [43.65, 55, 65.41],
  "southern-ice": [41.2, 51.91, 61.74],
  "austral-corridor": [43.65, 49, 58.27],
};

const TIME_PITCH: Record<Environment["time"], number> = {
  dawn: 0.94,
  day: 1,
  dusk: 0.9,
  night: 0.84,
};

export type SoundMixLevels = {
  master: number;
  ambience: number;
  effects: number;
};

export type SoundVoice = {
  fundamental: number;
  warmPartial: number;
  presencePartial: number;
};

export function soundMixLevels(enabled: boolean, master: number, ambience: number, effects: number): SoundMixLevels {
  if (!enabled || master <= 0) return { master: 0, ambience: 0, effects: 0 };
  const effectsLevel = Math.max(0, effects) / 100 * 0.55;
  // The ambiance stays well below the short interface transient, but retains
  // enough mid-bass energy to survive the response curve of laptop speakers.
  const requestedAmbience = Math.max(0, ambience) / 100 * 0.18;
  return {
    master: Math.min(1, master / 100),
    ambience: effects === 0 ? requestedAmbience : Math.min(requestedAmbience, effectsLevel * 0.24),
    effects: effectsLevel,
  };
}

export function soundVoices(profile: SoundProfile, time: Environment["time"]): SoundVoice[] {
  const pitch = TIME_PITCH[time];
  return PROFILES[profile].map((frequency) => {
    const fundamental = Math.max(38, frequency * pitch);
    return {
      fundamental,
      warmPartial: fundamental * 3,
      presencePartial: fundamental * 4,
    };
  });
}

function createNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < data.length; index += 1) {
    previous = previous * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[index] = previous;
  }
  return buffer;
}

function registerSource(sources: Set<AudioScheduledSourceNode>, source: AudioScheduledSourceNode) {
  sources.add(source);
  source.addEventListener("ended", () => sources.delete(source), { once: true });
}

function stopSources(sources: Set<AudioScheduledSourceNode>) {
  for (const source of sources) {
    try { source.stop(); } catch { /* The source may already have ended. */ }
  }
  sources.clear();
}

function tone(graph: Graph, frequency: number, offset: number, duration: number, level: number, type: OscillatorType = "triangle") {
  // A small scheduling lead is more reliable than a zero-time start while a
  // newly user-activated Safari AudioContext is making its first render quantum.
  const start = graph.context.currentTime + Math.max(0.025, offset);
  const oscillator = graph.context.createOscillator();
  const filter = graph.context.createBiquadFilter();
  const gain = graph.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(420, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(filter).connect(gain).connect(graph.ambience);
  registerSource(graph.ambienceSources, oscillator);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function scheduleEnvironment(graph: Graph, props: Environment) {
  const voices = soundVoices(props.soundProfile, props.time);
  voices.forEach((voice, index) => {
    tone(graph, voice.fundamental, 0.04 + index * 0.12, 6.2 + index * 0.28, 0.11 / (index + 1));
    // Restrained harmonics preserve the low-note identity while making the
    // procedural pad audible on hardware that cannot reproduce 38–90 Hz well.
    tone(graph, voice.warmPartial, 0.08 + index * 0.12, 5.9 + index * 0.24, 0.085 / (index + 1), "sine");
    tone(graph, voice.presencePartial, 0.13 + index * 0.12, 5.5 + index * 0.2, 0.035 / (index + 1), "sine");
  });
  tone(graph, voices[0].fundamental, 0.28, 6.4, 0.045);

  const source = graph.context.createBufferSource();
  const filter = graph.context.createBiquadFilter();
  const gain = graph.context.createGain();
  const now = graph.context.currentTime;
  source.buffer = graph.noiseBuffer;
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = props.storming ? 170 : 245 + props.seaState * 16 + props.currentSpeed * 8;
  const environmentalLevel = props.storming ? 0.2 : props.precipitation === "none" ? 0.08 : 0.12;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(environmentalLevel, now + 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 6.1);
  source.connect(filter).connect(gain).connect(graph.ambience);
  registerSource(graph.ambienceSources, source);
  source.start(now, (props.windSpeed + props.currentSpeed) % 4);
  source.stop(now + 6.15);
}

function interfaceEffect(graph: Graph) {
  const start = graph.context.currentTime;
  const oscillator = graph.context.createOscillator();
  const gain = graph.context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(210, start);
  oscillator.frequency.exponentialRampToValueAtTime(145, start + 0.075);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
  oscillator.connect(gain).connect(graph.effects);
  registerSource(graph.effectSources, oscillator);
  oscillator.start();
  oscillator.stop(start + 0.11);
}

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function createGraph() {
  const audioWindow = window as AudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio is unavailable");
  const context = new AudioContextConstructor();
  const master = context.createGain();
  const ambience = context.createGain();
  const effects = context.createGain();
  master.gain.value = 0;
  ambience.gain.value = 0;
  effects.gain.value = 0;
  ambience.connect(master);
  effects.connect(master);
  master.connect(context.destination);
  return {
    context,
    master,
    ambience,
    effects,
    noiseBuffer: createNoiseBuffer(context),
    ambienceSources: new Set<AudioScheduledSourceNode>(),
    effectSources: new Set<AudioScheduledSourceNode>(),
    environmentKey: null,
    timer: 0,
  } satisfies Graph;
}

function environmentKey(environment: Environment) {
  return [
    environment.climate,
    environment.time,
    environment.precipitation,
    environment.seaState,
    environment.storming ? 1 : 0,
    environment.region,
    environment.soundProfile,
    environment.windSpeed,
    environment.currentSpeed,
  ].join("|");
}

function stopEnvironment(graph: Graph) {
  window.clearInterval(graph.timer);
  graph.timer = 0;
  graph.environmentKey = null;
  stopSources(graph.ambienceSources);
}

function startEnvironment(graph: Graph, environment: Environment, force = false) {
  const key = environmentKey(environment);
  if (!force && graph.environmentKey === key && graph.timer !== 0 && graph.ambienceSources.size > 0) return;
  stopEnvironment(graph);
  graph.environmentKey = key;
  scheduleEnvironment(graph, environment);
  const interval = Math.max(4200, 5600 - environment.seaState * 140 - (environment.storming ? 300 : 0));
  graph.timer = window.setInterval(() => scheduleEnvironment(graph, environment), interval);
}

function applyMix(graph: Graph, levels: SoundMixLevels, immediate = false) {
  const now = graph.context.currentTime;
  const entries: Array<[GainNode, number, number]> = [
    [graph.master, levels.master, 0.04],
    [graph.effects, levels.effects, 0.04],
    [graph.ambience, levels.ambience, 0.08],
  ];
  for (const [node, value, timeConstant] of entries) {
    node.gain.cancelScheduledValues(now);
    if (immediate) node.gain.setValueAtTime(value, now);
    else node.gain.setTargetAtTime(value, now, timeConstant);
  }
}

function contextIsRunning(context: AudioContext) {
  // WebKit may expose an additional runtime "interrupted" state even though
  // the cross-browser TypeScript union only lists suspended/running/closed.
  return String(context.state) === "running";
}

const Soundscape = forwardRef<SoundscapeHandle, Props>(function Soundscape(props, ref) {
  const graphRef = useRef<Graph | null>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsOpenerRef = useRef<HTMLElement | null>(null);
  const soundToggleRef = useRef<HTMLButtonElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [master, setMaster] = useState(52);
  const [ambience, setAmbience] = useState(42);
  const [effects, setEffects] = useState(72);
  const [unavailable, setUnavailable] = useState(false);
  const [contextRunning, setContextRunning] = useState(false);
  const [activationBlocked, setActivationBlocked] = useState(false);
  const audibleAmbience = enabled && master > 0 && ambience > 0;
  const environment = useMemo<Environment>(() => ({
    climate: props.climate,
    time: props.time,
    precipitation: props.precipitation,
    seaState: props.seaState,
    storming: props.storming,
    region: props.region,
    soundProfile: props.soundProfile,
    windSpeed: props.windSpeed,
    currentSpeed: props.currentSpeed,
  }), [props.climate, props.currentSpeed, props.precipitation, props.region, props.seaState, props.soundProfile, props.storming, props.time, props.windSpeed]);

  const visibleReturnTarget = () => {
    const opener = settingsOpenerRef.current;
    if (opener?.isConnected && opener.getClientRects().length > 0 && getComputedStyle(opener).visibility !== "hidden") return opener;
    return soundToggleRef.current;
  };

  const closeSettings = (deferFocus = true) => {
    if (settingsRef.current) settingsRef.current.open = false;
    const restore = () => visibleReturnTarget()?.focus();
    if (deferFocus) window.requestAnimationFrame(restore);
    else restore();
  };

  useImperativeHandle(ref, () => ({
    openSettings(opener = null) {
      settingsOpenerRef.current = opener;
      if (!settingsRef.current) return;
      settingsRef.current.open = true;
      window.requestAnimationFrame(() => settingsCloseRef.current?.focus());
    },
  }), []);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      setActivationBlocked(false);
      return;
    }

    let graph = graphRef.current;
    try {
      if (!graph || graph.context.state === "closed") graph = createGraph();
      graphRef.current = graph;
    } catch {
      setUnavailable(true);
      setEnabled(false);
      setContextRunning(false);
      return;
    }

    try {
      // Queue the first environment phrase and establish its non-zero mix in
      // the button's direct activation task. This satisfies Safari's stricter
      // user-gesture path instead of waiting for a later React effect.
      applyMix(graph, soundMixLevels(true, master, ambience, effects), true);
      if (ambience > 0) startEnvironment(graph, environment, true);
      if (!contextIsRunning(graph.context)) await graph.context.resume();
      if (!contextIsRunning(graph.context)) throw new Error("Audio context did not enter the running state");
      setUnavailable(false);
      setActivationBlocked(false);
      setContextRunning(true);
      setEnabled(true);
    } catch {
      stopEnvironment(graph);
      stopSources(graph.effectSources);
      applyMix(graph, soundMixLevels(false, master, ambience, effects), true);
      setActivationBlocked(true);
      setEnabled(false);
      setContextRunning(false);
    }
  };

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const levels = soundMixLevels(enabled, master, ambience, effects);
    applyMix(graph, levels);
    if (!enabled) {
      stopEnvironment(graph);
      stopSources(graph.effectSources);
    }
  }, [enabled, master, ambience, effects]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (!audibleAmbience || !contextRunning) {
      stopEnvironment(graph);
      return;
    }
    startEnvironment(graph, environment);
  }, [audibleAmbience, contextRunning, environment]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button:not(:disabled), summary, select") : null;
      const graph = graphRef.current;
      if (!enabled || master <= 0 || !target || !graph) return;
      if (contextIsRunning(graph.context)) {
        if (effects > 0) interfaceEffect(graph);
        return;
      }
      // Browsers may suspend an established context when a tab or device sleeps.
      // The next explicit interface gesture is a valid recovery point. Restart
      // the environmental scheduler as well as the short interface sound.
      void graph.context.resume()
        .then(() => {
          if (!contextIsRunning(graph.context)) return;
          setActivationBlocked(false);
          setContextRunning(true);
          applyMix(graph, soundMixLevels(true, master, ambience, effects), true);
          if (ambience > 0) startEnvironment(graph, environment, true);
          if (effects > 0) interfaceEffect(graph);
        })
        .catch(() => undefined);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [ambience, effects, enabled, environment, master]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !enabled) return;
    const reflectContextState = () => {
      const running = contextIsRunning(graph.context);
      setContextRunning(running);
      if (!running) return;
      setActivationBlocked(false);
      applyMix(graph, soundMixLevels(true, master, ambience, effects), true);
      if (ambience > 0) startEnvironment(graph, environment);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reflectContextState();
    };
    graph.context.addEventListener("statechange", reflectContextState);
    window.addEventListener("pageshow", reflectContextState);
    document.addEventListener("visibilitychange", onVisibility);
    reflectContextState();
    return () => {
      graph.context.removeEventListener("statechange", reflectContextState);
      window.removeEventListener("pageshow", reflectContextState);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ambience, effects, enabled, environment, master]);

  useEffect(() => () => {
    const graph = graphRef.current;
    if (!graph) return;
    stopEnvironment(graph);
    stopSources(graph.effectSources);
    void graph.context.close();
  }, []);

  const soundStatus = !enabled ? "MUTED" : contextRunning ? "PLAYING" : "PAUSED";
  const soundDescription = unavailable
    ? "Sound synthesis is unavailable in this browser; play remains fully usable without it."
    : activationBlocked
      ? "Browser audio did not start. Allow audio for this local site, then choose the ambiance button again."
      : enabled && !contextRunning
        ? "Browser audio is paused. Your next game control will safely resume the local ambiance."
        : `Original environment-derived low-note ambiance for ${props.region}. No recordings or network audio.`;

  return (
    <div className="sound-module">
      <button ref={soundToggleRef} className="icon-button sound-toggle" type="button" aria-pressed={enabled} aria-label={enabled ? "Mute all sound" : "Enable quiet ambiance and sound effects"} onClick={() => void toggle()}>{enabled ? "♪" : "♩"}</button>
      <details ref={settingsRef} className="sound-settings" onKeyDown={(event) => {
        if (event.key === "Escape" && settingsRef.current?.open) {
          event.preventDefault();
          settingsRef.current.open = false;
          closeSettings();
        }
      }}>
        <summary onClick={() => {
          if (!settingsRef.current?.open) settingsOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}>SOUND</summary>
        <section role="dialog" aria-modal="false" aria-label="Sound settings" aria-describedby="sound-settings-description sound-mix-note">
          <div className="sound-heading"><strong id="sound-settings-title">SOUND MIX</strong><span role="status" aria-live="polite" aria-atomic="true">{soundStatus}</span><button ref={settingsCloseRef} className="sound-settings-close" type="button" aria-label="Close audio controls" onClick={() => closeSettings()}>×</button></div>
          <p id="sound-settings-description">{soundDescription}</p>
          <label htmlFor="sound-master"><span>MASTER</span><input id="sound-master" aria-describedby="sound-mix-note" aria-valuetext={`${master} percent`} type="range" min="0" max="100" value={master} onChange={(event) => setMaster(Number(event.target.value))} /><output htmlFor="sound-master" aria-hidden="true">{master}%</output></label>
          <label htmlFor="sound-ambiance"><span>AMBIANCE</span><input id="sound-ambiance" aria-describedby="sound-mix-note" aria-valuetext={`${ambience} percent`} type="range" min="0" max="100" value={ambience} onChange={(event) => setAmbience(Number(event.target.value))} /><output htmlFor="sound-ambiance" aria-hidden="true">{ambience}%</output></label>
          <label htmlFor="sound-effects"><span>SOUND EFFECTS</span><input id="sound-effects" aria-describedby="sound-mix-note" aria-valuetext={`${effects} percent`} type="range" min="0" max="100" value={effects} onChange={(event) => setEffects(Number(event.target.value))} /><output htmlFor="sound-effects" aria-hidden="true">{effects}%</output></label>
          <small id="sound-mix-note">Ambiance is capped well below effects whenever effects are audible.</small>
          <div className="sound-actions"><button type="button" disabled={unavailable} onClick={() => void toggle()}>{enabled ? "MUTE ALL" : "ENABLE ALL"}</button><button type="button" onClick={() => { closeSettings(false); props.onOpenCredits(); }}>CREDITS &amp; LICENSES</button></div>
        </section>
      </details>
    </div>
  );
});

export default Soundscape;
