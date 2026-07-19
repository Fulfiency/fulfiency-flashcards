"use client";

import { useState, useEffect, useCallback } from "react";
import { getSettings, saveSettings, type UserSettings } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(getSettings);

  useEffect(() => {
    function onSettingsChange(e: Event) {
      setSettings((e as CustomEvent).detail);
    }
    window.addEventListener("settings-change", onSettingsChange);
    return () => window.removeEventListener("settings-change", onSettingsChange);
  }, []);

  const update = useCallback((patch: Partial<UserSettings>) => {
    const merged = saveSettings(patch);
    setSettings(merged);
  }, []);

  return { settings, update };
}
