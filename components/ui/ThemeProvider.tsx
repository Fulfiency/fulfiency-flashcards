"use client";

import { useEffect } from "react";
import { getSettings } from "@/lib/settings";

export default function ThemeProvider() {
  useEffect(() => {
    function applyTheme() {
      const s = getSettings();
      document.body.classList.toggle("theme-light", s.theme === "light");
    }
    applyTheme();
    window.addEventListener("settings-change", applyTheme);
    return () => window.removeEventListener("settings-change", applyTheme);
  }, []);

  return null;
}
