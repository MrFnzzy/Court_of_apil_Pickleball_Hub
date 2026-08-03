"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calm, loopable "pickleball court at golden hour" ambient music.
 *
 * Like InteractionFX, this is fully synthesized with the Web Audio API —
 * no audio files, nothing to fetch, nothing added to the bundle, and no
 * copyright/licensing to worry about because nothing is a recording.
 *
 * Musical idea: a slow, warm four-chord pad loop (Am9 - Fmaj7 - Cmaj7 - G6,
 * ~7.5s per chord) under a soft lowpass filter that breathes very slowly.
 * Sparse mallet-like "pop" notes — a gentle nod to a paddle meeting a ball —
 * are scattered on top, but slowed way down and softened so they read as
 * wind-chime accents, not a rally. A quiet, filtered noise bed underneath
 * suggests open-air court ambience (breeze, distant courts) rather than a
 * silent studio. Nothing here is upbeat or percussive on purpose — the goal
 * is something you could nap to.
 *
 * Autoplay policies mean audio can only start from a real user gesture, so
 * this renders a small "Play court music" toggle. The user's choice (and
 * volume) is remembered for next time, but we always wait for a click
 * before making any sound.
 */

const STORAGE_KEY = "heidesPickleballHub.musicEnabled";
const VOLUME_KEY = "heidesPickleballHub.musicVolume";
const BAR_SECONDS = 7.5; // one chord per bar — slow and unhurried
const LOOKAHEAD_MS = 100; // how often the scheduler wakes up
const SCHEDULE_AHEAD_SECONDS = 0.3; // how far into the future we queue notes

// --- tiny note-name -> frequency helper (equal temperament, A4 = 440Hz) ---
const SEMITONES: Record<string, number> = {
  C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4,
  "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2,
};
function noteFreq(note: string): number {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 440;
  const [, name, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitonesFromA4 = SEMITONES[name] + (octave - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// Four warm, unresolved-feeling chords that loop comfortably forever.
const CHORDS: string[][] = [
  ["A3", "C4", "E4", "G4"], // Am7
  ["F3", "A3", "C4", "E4"], // Fmaj7
  ["C4", "E4", "G4", "B4"], // Cmaj7
  ["G3", "B3", "D4", "E4"], // G6
];
// Same key's minor pentatonic, for the sparse chime accents.
const CHIME_NOTES = ["A4", "C5", "D5", "E5", "G4", "E4"];

export default function AmbientCourtMusic() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [ready, setReady] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const nextBarTimeRef = useRef(0);
  const barIndexRef = useRef(0);
  const noiseNodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);

  // Restore saved preferences (but never autoplay — that needs a real click).
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem(VOLUME_KEY);
      if (savedVol) setVolume(parseFloat(savedVol));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  function ensureContext(): AudioContext {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      ctxRef.current = ctx;

      // Master volume, with a slow-breathing lowpass filter shared by every
      // pad note — this is what gives the pad its gentle, evolving warmth
      // without adding any rhythm or urgency.
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      masterGainRef.current = master;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      filter.Q.value = 0.3;
      filter.connect(master);
      filterRef.current = filter;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / 22; // one gentle sweep every ~22 seconds
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 450; // sweep depth in Hz
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();

      // Quiet filtered noise bed = soft open-air "breeze" under the court.
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // brown-ish noise: soft, not hissy
        data[i] = last * 3.5;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buffer;
      noiseSrc.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 500;
      noiseFilter.Q.value = 0.5;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.025;
      noiseSrc.connect(noiseFilter).connect(noiseGain).connect(master);
      noiseSrc.start();
      noiseNodesRef.current = { src: noiseSrc, gain: noiseGain };
    }
    return ctxRef.current;
  }

  // One held pad chord, with a slow attack/release so chords melt into
  // each other rather than starting/stopping abruptly.
  function playChord(ctx: AudioContext, notes: string[], startTime: number, duration: number) {
    const filter = filterRef.current!;
    notes.forEach((note, i) => {
      const freq = noteFreq(note);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.05, startTime + 2.2); // slow swell in
      gain.gain.setValueAtTime(0.05, startTime + duration - 2.2);
      gain.gain.linearRampToValueAtTime(0, startTime + duration); // slow fade out

      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = (i / (notes.length - 1)) * 1.0 - 0.5;

      [{ type: "sine" as OscillatorType, detune: 0 }, { type: "triangle" as OscillatorType, detune: 5 }].forEach(
        (layer) => {
          const osc = ctx.createOscillator();
          osc.type = layer.type;
          osc.frequency.value = freq;
          osc.detune.value = layer.detune;
          osc.connect(gain);
          osc.start(startTime);
          osc.stop(startTime + duration + 0.1);
        }
      );

      if (pan) {
        gain.connect(pan).connect(filter);
      } else {
        gain.connect(filter);
      }
    });
  }

  // A single soft, low "bounce" thump on the downbeat of each bar — a very
  // gentle heartbeat/pulse, never sharp or percussive enough to feel upbeat.
  function playBounce(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
    osc.connect(gain).connect(filterRef.current!);
    osc.start(time);
    osc.stop(time + 0.75);
  }

  // A single soft mallet/chime "pop" — the paddle-and-ball idea, slowed
  // and softened into something more like a wind chime than a rally.
  function playChime(ctx: AudioContext, note: string, time: number, pan: number) {
    const freq = noteFreq(note);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain).connect(panner).connect(filterRef.current!);
    } else {
      osc.connect(gain).connect(filterRef.current!);
    }
    osc.start(time);
    osc.stop(time + 1.7);
  }

  function scheduleBar(ctx: AudioContext, barIndex: number, startTime: number) {
    const chord = CHORDS[barIndex % CHORDS.length];
    playChord(ctx, chord, startTime, BAR_SECONDS + 0.5);
    playBounce(ctx, startTime);

    // 1–2 sparse chime accents per bar, at unhurried, non-mechanical offsets.
    const accentCount = 1 + (barIndex % 2);
    for (let a = 0; a < accentCount; a++) {
      const offset = BAR_SECONDS * (0.35 + a * 0.4 + Math.random() * 0.1);
      const note = CHIME_NOTES[(barIndex + a * 2) % CHIME_NOTES.length];
      const pan = a % 2 === 0 ? -0.35 : 0.35;
      playChime(ctx, note, startTime + offset, pan);
    }
  }

  function schedulerTick() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    while (nextBarTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleBar(ctx, barIndexRef.current, nextBarTimeRef.current);
      nextBarTimeRef.current += BAR_SECONDS;
      barIndexRef.current += 1;
    }
    schedulerIdRef.current = window.setTimeout(schedulerTick, LOOKAHEAD_MS);
  }

  function start() {
    const ctx = ensureContext();
    if (ctx.state === "suspended") ctx.resume();
    const master = masterGainRef.current!;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);

    if (schedulerIdRef.current === null) {
      nextBarTimeRef.current = ctx.currentTime + 0.15;
      barIndexRef.current = 0;
      schedulerTick();
    }
    setPlaying(true);
    try {
      localStorage.setItem(STORAGE_KEY, "on");
    } catch {
      // ignore
    }
  }

  function stop() {
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    }
    if (schedulerIdRef.current !== null) {
      window.clearTimeout(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    setPlaying(false);
    try {
      localStorage.setItem(STORAGE_KEY, "off");
    } catch {
      // ignore
    }
  }

  function toggle() {
    if (playing) stop();
    else start();
  }

  function handleVolumeChange(next: number) {
    setVolume(next);
    try {
      localStorage.setItem(VOLUME_KEY, String(next));
    } catch {
      // ignore
    }
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (ctx && master && playing) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(next, ctx.currentTime + 0.15);
    }
  }

  // Stop cleanly if the component ever unmounts (e.g. hot reload in dev).
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current !== null) window.clearTimeout(schedulerIdRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="fx-music-widget">
      <button
        type="button"
        onClick={toggle}
        className="fx-music-toggle focus-ring"
        aria-pressed={playing}
        aria-label={playing ? "Pause calm court music" : "Play calm court music"}
        title={playing ? "Pause calm court music" : "Play calm court music"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M7 5v14l12-7Z" />
          </svg>
        )}
      </button>
      <label className="fx-music-volume" aria-label="Music volume">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}
