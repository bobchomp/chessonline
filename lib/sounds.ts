"use client";

/**
 * Board sounds, synthesised with the Web Audio API so there are no audio files
 * to download or license. Muting is remembered per browser.
 */

export type SoundKind = "move" | "capture" | "check" | "start" | "end";

const STORAGE_KEY = "chess-sound";
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
  } catch {
    // Private mode etc.: the setting just won't stick.
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  // Browsers start the context suspended until the page has been interacted with.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** A short burst of filtered noise: the "thock" of a piece landing on wood. */
function knock(ac: AudioContext, at: number, freq: number, gain: number, length = 0.09) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
}

/** A soft sine tone, for checks and game start/end. */
function tone(ac: AudioContext, at: number, freq: number, gain: number, length: number) {
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function playSound(kind: SoundKind) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.005;
  switch (kind) {
    case "move":
      knock(ac, t, 900, 1.6);
      break;
    case "capture":
      knock(ac, t, 700, 1.9);
      knock(ac, t + 0.045, 1300, 1.2, 0.07);
      break;
    case "check":
      knock(ac, t, 900, 1.4);
      tone(ac, t + 0.02, 880, 0.12, 0.25);
      break;
    case "start":
      tone(ac, t, 523.25, 0.12, 0.18);
      tone(ac, t + 0.12, 783.99, 0.12, 0.3);
      break;
    case "end":
      tone(ac, t, 783.99, 0.12, 0.18);
      tone(ac, t + 0.14, 523.25, 0.12, 0.4);
      break;
  }
}

/** Which sound a move in SAN should make. */
export function soundForSan(san: string): SoundKind {
  if (san.includes("+") || san.includes("#")) return "check";
  if (san.includes("x")) return "capture";
  return "move";
}

/** Unlock audio on the first interaction, so the opponent's moves can be heard. Returns a cleanup. */
export function unlockAudioOnInteraction(): () => void {
  const stop = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  const unlock = () => {
    audio();
    stop();
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return stop;
}
