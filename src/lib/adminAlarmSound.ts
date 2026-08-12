/**
 * Loud "new booking" alarm for the admin dashboard.
 *
 * Synthesized in-browser with the Web Audio API (same approach as
 * promoFxSound.ts) — no audio file to fetch or bundle. Unlike the
 * customer-facing sound effects, this does NOT respect the site's
 * "soundEnabled" mute flag: it's a work tool for staff, not a promo
 * effect for visitors, and it has its own mute switch (see
 * isAlarmMuted / setAlarmMuted below, wired up in the admin header).
 *
 * Two-tone siren, deliberately harsh and loud, plus an original spoken
 * "New booking!" cue (browser text-to-speech — not a recording of
 * anyone else's branded notification sound), repeated so it can't be
 * missed even if the admin has stepped away from the desk. Call
 * startRepeatingAlarm() to begin; it returns a stop() function so the
 * caller can cut it off early (e.g. the moment the admin opens the
 * notification bell, or the pending count drops back to zero).
 *
 * IMPORTANT — browser autoplay policy: Chrome/Safari/Firefox all refuse
 * to play ANY audio (Web Audio, <audio>, speechSynthesis) on a page
 * until the person has interacted with that page at least once (a
 * click, tap, or keypress). Since new bookings arrive via a background
 * poll — not a click — the very first alarm after a fresh page load can
 * be silently blocked even though this code runs without error. Call
 * unlockAudio() from a real click handler (see the "Test alarm sound"
 * button in the admin header) to prime both the AudioContext and
 * speechSynthesis ahead of time so later automatic alarms aren't
 * silently swallowed.
 */

const MUTE_KEY = "heidesPickleballHub.adminAlarmMuted";

export function isAlarmMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setAlarmMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "on" : "off");
  } catch {
    // ignore
  }
}

let sharedCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

/**
 * Must be called synchronously inside a real user gesture (onClick,
 * onTouchStart, etc). Creates/resumes the AudioContext and fires a
 * silent, near-zero-volume speechSynthesis utterance — both of which
 * "unlock" that browser tab to play audio automatically later, without
 * the admin actually hearing anything at unlock time. Safe to call
 * more than once.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    // ignore — speech synthesis just won't be available
  }
  unlocked = true;
}

/** Whether unlockAudio() has run in this tab yet — lets the UI show a
 * "tap to enable sound" hint only when it's actually still needed. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** One siren "wail": two loud square-wave tones alternating, plus a hard
 * transient on each switch so it cuts through even on tinny laptop
 * speakers. Runs close to full gain — this is meant to be heard. */
function playOneWail(ctx: AudioContext, startTime: number) {
  const duration = 0.9;
  const highFreq = 1046.5; // C6
  const lowFreq = 784; // G5
  const segments = 6;
  const segLen = duration / segments;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, startTime);
  master.connect(ctx.destination);

  for (let i = 0; i < segments; i++) {
    const t = startTime + i * segLen;
    const freq = i % 2 === 0 ? highFreq : lowFreq;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
    gain.gain.setValueAtTime(1.0, t + segLen - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + segLen - 0.005);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + segLen);
  }
}

/** Original spoken cue using the browser's built-in text-to-speech —
 * announces "New booking!" out loud. This is Anthropic/browser TTS
 * synthesizing our own text, not a recording of any third party's
 * branded notification sound. Silently no-ops if the browser has no
 * speechSynthesis support or no voices installed. */
function announce(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.15;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

/**
 * Starts the alarm, repeating up to `times` wails (default 100) roughly
 * a second apart, each followed by a spoken "New booking!" cue. Returns
 * a stop() function to cancel any wails that haven't played yet.
 * Automatically stops after `times` plays. Does nothing (and returns a
 * no-op stop) if the alarm is muted or Web Audio isn't available.
 */
export function startRepeatingAlarm(times = 100): { stop: () => void } {
  if (isAlarmMuted()) return { stop: () => {} };
  const ctx = getCtx();
  if (!ctx) return { stop: () => {} };

  let stopped = false;
  const wailInterval = 1.6; // seconds between wail starts — leaves room for the voice cue

  // Schedule a first batch immediately so the alarm starts without delay,
  // then keep topping up on a timer so we don't schedule 100 oscillators
  // at once (and so stop() actually prevents future wails from firing).
  let played = 0;
  function scheduleNext() {
    if (stopped || played >= times) return;
    const ctxNow = getCtx();
    if (!ctxNow) return;
    playOneWail(ctxNow, ctxNow.currentTime);
    if (played % 2 === 0) announce("New booking!");
    played += 1;
    if (played < times) {
      timer = window.setTimeout(scheduleNext, wailInterval * 1000);
    }
  }
  let timer = window.setTimeout(scheduleNext, 0);

  return {
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    },
  };
}

/** Plays a single wail + voice cue immediately, ignoring the mute flag —
 * used by the "Test alarm sound" button so the admin can always check
 * what it sounds like (and, as a side effect, this click also unlocks
 * audio for this tab per the autoplay-policy note above). */
export function playTestAlarm() {
  unlockAudio();
  const ctx = getCtx();
  if (!ctx) return;
  playOneWail(ctx, ctx.currentTime);
  announce("New booking!");
}

