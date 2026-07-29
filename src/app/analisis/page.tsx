import { BarChart3, Moon, Sun, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const futureCards = [
  { label: "Turnos por médico", icon: Users },
  { label: "Distribución de día", icon: Sun },
  { label: "Distribución de noche", icon: Moon },
  { label: "Evolución mensual", icon: BarChart3 },
];

export default function AnalisisPage() {
  return (
    <>
      <PageHeader
        description="Este módulo crecerá con indicadores para apoyar decisiones de distribución y carga."
        eyebrow="Próximamente"
        title="Análisis de turnos"
      />
      <section className="glass overflow-hidden rounded-[2rem] p-6 sm:p-10">
        <div className="max-w-xl">
          <span className="inline-flex rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            En preparación
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            La información ya está organizada para analizarla.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Dejamos este espacio listo, sin adelantar métricas que el equipo aún no ha
            definido.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {futureCards.map(({ label, icon: Icon }) => (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" key={label}>
              <Icon className="text-[var(--brand)]" size={20} />
              <p className="mt-8 text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
