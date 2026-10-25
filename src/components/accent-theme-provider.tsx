"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { isThemeChoice, resolveAccentTheme, type ThemeChoice, type PublishedTheme } from "@/lib/accent-theme";

const STORAGE_KEY = "turnapp:theme-preview:v2";
const CHANGE_EVENT = "turnapp:theme-preview-change";
type Preview = { theme: ThemeChoice; revision: string };
type Appearance = { published: PublishedTheme; preview: Preview | null };
const initial: PublishedTheme = { theme: "auto", revision: "initial" };

function apply(theme: ThemeChoice) {
  const resolved = resolveAccentTheme(theme);
  if (resolved === "green") document.documentElement.removeAttribute("data-color-theme");
  else document.documentElement.dataset.colorTheme = resolved;
}
function readPreview(): Preview | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return value && isThemeChoice(value.theme) && typeof value.revision === "string" ? value : null;
  } catch { return null; }
}
function savePreview(preview: Preview | null) {
  try {
    if (preview) localStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* In-memory preview still works when storage is blocked. */ }
}
function parsePublished(value: PublishedTheme): PublishedTheme {
  if (!isThemeChoice(value.theme) || typeof value.revision !== "string") throw new Error("Respuesta de apariencia no válida");
  return value;
}

const AccentContext = createContext<{
  selected: ThemeChoice; published: ThemeChoice; localPreview: boolean;
  loaded: boolean; publishing: boolean; error: string | null;
  select: (theme: ThemeChoice) => void; discard: () => void; publish: () => Promise<void>;
} | null>(null);

export function useAccentTheme() {
  const context = useContext(AccentContext);
  if (!context) throw new Error("Falta AccentThemeProvider");
  return context;
}

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>({ published: initial, preview: null });
  const current = useRef(appearance);
  const epoch = useRef(0);
  const busy = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commit(next: Appearance) {
    current.current = next;
    apply(next.preview?.theme ?? next.published.theme);
    setAppearance(next);
  }

  useEffect(() => {
    let disposed = false;
    const controllers = new Set<AbortController>();
    const initialize = window.setTimeout(() => {
      commit({ ...current.current, preview: readPreview() });
    }, 0);
    async function refresh() {
      if (busy.current || document.visibilityState === "hidden") return;
      const version = ++epoch.current;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const response = await fetch("/api/appearance", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo cargar el tema publicado");
        const published = parsePublished(await response.json());
        if (disposed || version !== epoch.current) return;
        const saved = current.current.preview ?? readPreview();
        const preview = saved?.revision === published.revision ? saved : null;
        if (saved && !preview) savePreview(null);
        commit({ published, preview });
        setError(null);
      } catch {
        if (!disposed && version === epoch.current) setError("No se pudo cargar el tema publicado. La vista previa local sigue disponible.");
      } finally {
        controllers.delete(controller);
        if (!disposed && version === epoch.current) setLoaded(true);
      }
    }
    const syncPreview = () => {
      const saved = readPreview();
      commit({ ...current.current, preview: saved?.revision === current.current.published.revision ? saved : null });
    };
    const firstRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      apply(current.current.preview?.theme ?? current.current.published.theme);
      void refresh();
    }, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("storage", syncPreview);
    window.addEventListener(CHANGE_EVENT, syncPreview);
    return () => {
      disposed = true;
      controllers.forEach((controller) => controller.abort());
      window.clearTimeout(initialize);
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("storage", syncPreview);
      window.removeEventListener(CHANGE_EVENT, syncPreview);
    };
  }, []);

  function select(theme: ThemeChoice) {
    const preview = { theme, revision: current.current.published.revision };
    savePreview(preview);
    commit({ ...current.current, preview }); // Immediate, with no network write.
  }
  function discard() {
    savePreview(null);
    commit({ ...current.current, preview: null });
  }
  async function publish() {
    if (busy.current) return;
    busy.current = true;
    ++epoch.current; // Ignore reads started before this publication.
    setPublishing(true);
    try {
      const response = await fetch("/api/appearance", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: current.current.preview?.theme ?? current.current.published.theme }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo publicar el tema");
      const published = parsePublished(result);
      savePreview(null);
      commit({ published, preview: null });
      setError(null);
      setLoaded(true);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } finally {
      ++epoch.current;
      busy.current = false;
      setPublishing(false);
    }
  }
  return <AccentContext.Provider value={{
    selected: appearance.preview?.theme ?? appearance.published.theme,
    published: appearance.published.theme, localPreview: Boolean(appearance.preview),
    loaded, publishing, error, select, discard, publish,
  }}>{children}</AccentContext.Provider>;
}
