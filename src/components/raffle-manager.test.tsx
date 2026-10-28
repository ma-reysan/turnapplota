import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RaffleManager, randomParticipantIndex } from "./raffle-manager";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Sorteos", () => {
  it("rechaza valores que introducirían sesgo", () => {
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockImplementationOnce((array) => { (array as Uint32Array)[0] = 4294967295; return array; });
    random.mockImplementationOnce((array) => { (array as Uint32Array)[0] = 2; return array; });
    expect(randomParticipantIndex(3)).toBe(2);
    expect(random).toHaveBeenCalledTimes(2);
    expect(() => randomParticipantIndex(0)).toThrow();
  });
  it("incluye solo activos del mes chileno publicado y respeta exclusiones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T01:00:00Z"));
    const doctors = ["Ana", "Bea", "Caro"].map((name, i) => ({ id: name, longName: name, shortName: name, active: i !== 2, sortOrder: i }));
    render(<RaffleManager doctors={doctors} schedules={[{ id: "oct", year: 2026, month: 10, status: "published", assignments: doctors.map((d, i) => ({ id: d.id, doctorId: d.id, date: "2026-10-28", kind: "DAY", slot: i })) }]} />);
    expect(screen.queryByLabelText("Caro")).toBeNull();
    fireEvent.click(screen.getByLabelText("Ana"));
    fireEvent.click(screen.getByRole("button", { name: "Sortear" }));
    expect(screen.getByRole("status").textContent).toContain("Bea");
    fireEvent.click(screen.getByRole("button", { name: "Quitar todos" }));
    expect((screen.getByRole("button", { name: "Sortear" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Suspenso", () => {
  it("espera tres segundos, bloquea cambios y limpia el timer al salir", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const props = { doctors: [{ id: "a", longName: "Ana", shortName: "ANA", active: true, sortOrder: 0 }], schedules: [{ id: "m", year: 2026, month: 10, status: "published" as const, assignments: [{ id: "s", doctorId: "a", date: "2026-10-28", kind: "DAY" as const, slot: 0 }] }] };
    const { unmount } = render(<RaffleManager {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Suspenso 3 s/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sortear" }));
    expect(screen.getByRole("status").textContent).toBe("3");
    expect((screen.getByRole("button", { name: "Sorteando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Ana").closest("fieldset")?.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("status").textContent).toBe("1");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("status").textContent).toContain("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Sortear" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
