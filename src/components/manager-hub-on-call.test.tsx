import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditableOnCallCard } from "@/components/manager-hub";
import type { Doctor } from "@/lib/types";

const doctors: Doctor[] = [
  { id: "reyes", shortName: "REYES", longName: "Dra. Reyes", active: true, sortOrder: 1 },
  { id: "avila", shortName: "AVILA", longName: "Dr. Ávila", active: true, sortOrder: 2 },
];

afterEach(cleanup);

function renderCard(doctorId = "") {
  const onAssign = vi.fn();
  const onColor = vi.fn();
  render(<DndContext><EditableOnCallCard
    colorKey={null}
    colorLegend={[{ key: "yellow", label: "Amarillo" }]}
    disabled={false}
    doctorId={doctorId}
    doctors={doctors}
    highlightedDoctor={null}
    occupiedDoctorIds={[]}
    onAssign={onAssign}
    onColor={onColor}
    slot={0}
    week="2026-11-02"
  /></DndContext>);
  return { onAssign, onColor };
}

describe("tarjeta de médico de llamado", () => {
  it("permite escribir y asignar un médico como en la tabla de turnos", () => {
    const { onAssign } = renderCard();
    const input = screen.getByRole("textbox", { name: /Médico de llamado 1/ });
    fireEvent.change(input, { target: { value: "rey" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAssign).toHaveBeenCalledWith("reyes");
  });

  it("ofrece la misma paleta y una X para vaciar el cupo", () => {
    const { onAssign, onColor } = renderCard("reyes");
    fireEvent.click(screen.getByRole("button", { name: /Pintar llamado 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pintar Amarillo" }));
    expect(onColor).toHaveBeenCalledWith("yellow");
    fireEvent.click(screen.getByRole("button", { name: /Quitar a REYES del llamado/ }));
    expect(onAssign).toHaveBeenCalledWith("");
  });
});
