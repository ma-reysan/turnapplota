"use client";

import { useEffect } from "react";
import { isAccentTheme, isDieciochoSeason, type AccentTheme } from "@/lib/accent-theme";

const STORAGE_KEY = "turnapp:accent-theme";

function applyAccentTheme(theme: AccentTheme) {
  const root = document.documentElement;
  if (theme === "green") root.removeAttribute("data-color-theme");
  else root.dataset.colorTheme = theme;
}

function savedAccentTheme() {
  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isAccentTheme(savedTheme) ? savedTheme : "green";
}

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const syncAccentTheme = () => {
      applyAccentTheme(isDieciochoSeason() ? "dieciocho" : savedAccentTheme());
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
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("turnapp:accent-theme-change", syncOnPreferenceChange);
    };
  }, []);

  return children;
}
