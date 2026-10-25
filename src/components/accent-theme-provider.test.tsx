import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccentThemeProvider, useAccentTheme } from "./accent-theme-provider";

const key = "turnapp:theme-preview:v2";
function Controls() {
  const theme = useAccentTheme();
  return <div>
    <span>{theme.loaded ? "loaded" : "loading"}</span>
    <button onClick={() => theme.select("halloween")}>Preview</button>
    <button onClick={() => theme.select("christmas")}>Preview Christmas</button>
    <button onClick={theme.discard}>Discard</button>
    <button onClick={() => void theme.publish().catch(() => undefined)}>Publish</button>
    <span>{theme.localPreview ? "local" : "global"}</span>
  </div>;
}
function response(theme: string, revision: string) {
  return new Response(JSON.stringify({ theme, revision }), { status: 200 });
}
describe("local preview and global publication", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-color-theme");
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, options?: RequestInit) =>
      options?.method === "PUT" ? response("halloween", "published-2") : response("blue", "published-1")));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  async function mount() {
    render(<AccentThemeProvider><Controls /></AccentThemeProvider>);
    await screen.findByText("loaded");
    expect(document.documentElement.dataset.colorTheme).toBe("blue");
  }
  it("changes immediately on selection, persists locally, and never publishes on selection", async () => {
    await mount();
    fireEvent.click(screen.getByText("Preview"));
    expect(document.documentElement.dataset.colorTheme).toBe("halloween");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ theme: "halloween", revision: "published-1" });
    expect(vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== "PUT")).toBe(true);
    fireEvent.click(screen.getByText("Discard"));
    expect(document.documentElement.dataset.colorTheme).toBe("blue");
  });
  it("previews Christmas immediately and restores it after a reload without publishing", async () => {
    await mount();
    fireEvent.click(screen.getByText("Preview Christmas"));
    expect(document.documentElement.dataset.colorTheme).toBe("christmas");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ theme: "christmas", revision: "published-1" });
    cleanup();
    render(<AccentThemeProvider><Controls /></AccentThemeProvider>);
    await screen.findByText("loaded");
    expect(document.documentElement.dataset.colorTheme).toBe("christmas");
    expect(vi.mocked(fetch).mock.calls.every((call) => call[1]?.method !== "PUT")).toBe(true);
    fireEvent.click(screen.getByText("Discard"));
    expect(document.documentElement.dataset.colorTheme).toBe("blue");
  });
  it("publishes only on clicking Publish and returns to following the global theme", async () => {
    await mount();
    fireEvent.click(screen.getByText("Preview"));
    fireEvent.click(screen.getByText("Publish"));
    await screen.findByText("global");
    expect(fetch).toHaveBeenCalledWith("/api/appearance", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ theme: "halloween" }),
    }));
    expect(localStorage.getItem(key)).toBeNull();
    expect(document.documentElement.dataset.colorTheme).toBe("halloween");
  });
  it("keeps the local preview when publication fails", async () => {
    await mount();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "offline" }), { status: 503 }));
    fireEvent.click(screen.getByText("Preview"));
    fireEvent.click(screen.getByText("Publish"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(document.documentElement.dataset.colorTheme).toBe("halloween");
    expect(screen.getByText("local")).toBeTruthy();
  });
  it("adopts a newer publication even when this browser was previewing another theme", async () => {
    await mount();
    fireEvent.click(screen.getByText("Preview"));
    vi.mocked(fetch).mockResolvedValue(response("gold", "published-3"));
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(document.documentElement.dataset.colorTheme).toBe("gold"));
    expect(localStorage.getItem(key)).toBeNull();
  });
  it("applies the preview even if local storage is blocked", async () => {
    await mount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getByText("Preview"));
    expect(document.documentElement.dataset.colorTheme).toBe("halloween");
  });
});
