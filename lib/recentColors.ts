"use client";

const STORAGE_KEY = "fulfiency-recent-colors";
const MAX = 8;

export function getRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addRecentColor(color: string) {
  const recent = getRecentColors().filter((c) => c !== color);
  recent.unshift(color);
  if (recent.length > MAX) recent.length = MAX;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  return recent;
}

const SHORTCUT_KEY = "fulfiency-color-shortcuts";

export interface ColorShortcut {
  key: string;
  color: string;
  label: string;
}

const DEFAULTS: ColorShortcut[] = [
  { key: "1", color: "#c9a552", label: "Or" },
  { key: "2", color: "#73866d", label: "Vert" },
  { key: "3", color: "#e05c5c", label: "Rouge" },
  { key: "4", color: "#e8832a", label: "Orange" },
  { key: "5", color: "#4a9eff", label: "Bleu" },
  { key: "6", color: "#f5f0e8", label: "Blanc" },
];

export function getColorShortcuts(): ColorShortcut[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(SHORTCUT_KEY);
    if (!raw) return DEFAULTS;
    return JSON.parse(raw);
  } catch {
    return DEFAULTS;
  }
}

export function saveColorShortcuts(shortcuts: ColorShortcut[]) {
  localStorage.setItem(SHORTCUT_KEY, JSON.stringify(shortcuts));
}
