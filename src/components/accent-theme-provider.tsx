"use client";

import { useEffect } from "react";
import { resolveAccentTheme, type AccentTheme } from "@/lib/accent-theme";

const STORAGE_KEY = "turnapp:accent-theme";

function applyAccentTheme(theme: AccentTheme) {
  const root = document.documentElement;
  if (theme === "green") root.removeAttribute("data-color-theme");
  else root.dataset.colorTheme = theme;
}

function savedAccentTheme() {
  try {
    return resolveAccentTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return resolveAccentTheme(null);
  }
}

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const syncAccentTheme = () => {
      applyAccentTheme(savedAccentTheme());
    };
    const syncOnPreferenceChange = () => syncAccentTheme();
    const reschedule = () => {
      syncAccentTheme();
      const now = new Date();
      const millisecondsUntilNextMinute = 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds() + 25;
      timer = window.setTimeout(reschedule, millisecondsUntilNextMinute);
    };

    let timer = window.setTimeout(reschedule, 0);
    window.addEventListener("turnapp:accent-theme-change", syncOnPreferenceChange);
    window.addEventListener("storage", syncOnPreferenceChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("turnapp:accent-theme-change", syncOnPreferenceChange);
      window.removeEventListener("storage", syncOnPreferenceChange);
    };
  }, []);

  return children;
}

