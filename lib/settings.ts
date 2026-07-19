"use client";

export interface UserSettings {
  soundEnabled: boolean;
  soundVolume: number;
  particlesEnabled: boolean;
  cardsPerSession: number;
  theme: "dark" | "light";
  showIntervals: boolean;
  autoFlipDelay: number;
  dailyGoal: number;
  focusMode: boolean;
}

const DEFAULTS: UserSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  particlesEnabled: true,
  cardsPerSession: 50,
  theme: "dark",
  showIntervals: true,
  autoFlipDelay: 0,
  dailyGoal: 20,
  focusMode: false,
};

const STORAGE_KEY = "fulfiency-settings";

export function getSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: Partial<UserSettings>) {
  const current = getSettings();
  const merged = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("settings-change", { detail: merged }));
  return merged;
}
