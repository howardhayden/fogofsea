import assert from "node:assert/strict";
import test from "node:test";
import type { SoundProfile } from "../app/gameModel";
import { soundMixLevels, soundVoices } from "../app/Soundscape";

const profiles: SoundProfile[] = [
  "island-arc",
  "equatorial-current",
  "temperate-strait",
  "boreal-ice",
  "polar-archipelago",
  "southern-ice",
  "austral-corridor",
];

test("the default procedural ambience is audible while interface effects remain materially louder", () => {
  const levels = soundMixLevels(true, 52, 42, 72);
  const strongestAmbientTone = levels.master * levels.ambience * 0.11;
  const interfaceEffectPeak = levels.master * levels.effects * 0.22;

  assert.ok(strongestAmbientTone >= 0.003, `ambient peak ${strongestAmbientTone} should survive quiet laptop playback`);
  assert.ok(interfaceEffectPeak > strongestAmbientTone * 10, "interface effects should remain clearly louder than ambience");
  assert.deepEqual(soundMixLevels(false, 52, 42, 72), { master: 0, ambience: 0, effects: 0 });
  assert.deepEqual(soundMixLevels(true, 0, 42, 72), { master: 0, ambience: 0, effects: 0 });
});

test("muting effects does not also mute requested ambience", () => {
  const effectsMuted = soundMixLevels(true, 52, 42, 0);
  assert.equal(effectsMuted.effects, 0);
  assert.ok(effectsMuted.ambience > 0);

  const ambienceMuted = soundMixLevels(true, 52, 0, 72);
  assert.equal(ambienceMuted.ambience, 0);
  assert.ok(ambienceMuted.effects > 0);
});

test("every regional and time profile retains low fundamentals plus small-speaker warm partials", () => {
  for (const profile of profiles) {
    for (const time of ["dawn", "day", "dusk", "night"] as const) {
      const voices = soundVoices(profile, time);
      assert.equal(voices.length, 3);
      for (const voice of voices) {
        assert.ok(voice.fundamental >= 38 && voice.fundamental < 90, `${profile}/${time} fundamental ${voice.fundamental}`);
        assert.ok(voice.warmPartial >= 114 && voice.warmPartial < 270, `${profile}/${time} partial ${voice.warmPartial}`);
        assert.ok(voice.presencePartial >= 152 && voice.presencePartial < 360, `${profile}/${time} presence ${voice.presencePartial}`);
        assert.equal(voice.warmPartial, voice.fundamental * 3);
        assert.equal(voice.presencePartial, voice.fundamental * 4);
      }
    }
  }
});
