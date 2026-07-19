"use client";

const AudioContext = typeof window !== "undefined" ? window.AudioContext || (window as any).webkitAudioContext : null;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!AudioContext) return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

export function playFlip() {
  playTone(800, 0.08, "sine", 0.08);
  setTimeout(() => playTone(1200, 0.06, "sine", 0.06), 40);
}

export function playAgain() {
  playTone(300, 0.15, "square", 0.08);
  setTimeout(() => playTone(200, 0.2, "square", 0.06), 100);
}

export function playHard() {
  playTone(400, 0.12, "triangle", 0.1);
}

export function playGood() {
  playTone(523, 0.1, "sine", 0.1);
  setTimeout(() => playTone(659, 0.12, "sine", 0.08), 80);
}

export function playEasy() {
  playTone(523, 0.08, "sine", 0.1);
  setTimeout(() => playTone(659, 0.08, "sine", 0.08), 70);
  setTimeout(() => playTone(784, 0.15, "sine", 0.1), 140);
}

export function playSuccess() {
  playTone(523, 0.1, "sine", 0.12);
  setTimeout(() => playTone(659, 0.1, "sine", 0.1), 100);
  setTimeout(() => playTone(784, 0.1, "sine", 0.1), 200);
  setTimeout(() => playTone(1047, 0.25, "sine", 0.14), 300);
}

export function playClick() {
  playTone(600, 0.04, "sine", 0.05);
}

export function playNav() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(680, c.currentTime + 0.06);
  g.gain.setValueAtTime(0.06, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.12);
}

export function playError() {
  playTone(200, 0.15, "square", 0.1);
  setTimeout(() => playTone(180, 0.2, "square", 0.08), 120);
}

export function playDelete() {
  playTone(500, 0.06, "sine", 0.08);
  setTimeout(() => playTone(350, 0.1, "sine", 0.06), 60);
}

export function playAdd() {
  playTone(880, 0.06, "sine", 0.08);
  setTimeout(() => playTone(1100, 0.08, "sine", 0.06), 50);
}

const ratingsSounds: Record<number, () => void> = {
  1: playAgain,
  2: playHard,
  3: playGood,
  4: playEasy,
};

export function playRating(rating: number) {
  ratingsSounds[rating]?.();
}
