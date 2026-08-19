import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Disclaimer · TurnApp Lota",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Nota interna" title="Disclaimer" />
      <div className="glass space-y-3 rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
        <p>
          Este espacio queda para dejar notas y recordatorios para quienes mantengan o revisen
          TurnApp Lota más adelante.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>La app fue diseñada por el Dr. Mauricio Reyes y construida con ayuda de IA (Codex).</li>
          <li>
            Antes de modificar datos de producción, revisa <code>README.md</code> para conectar
            Neon PostgreSQL y no perder ediciones.
          </li>
          <li>Actualiza este texto (src/app/disclaimer/page.tsx) cuando tengas algo que dejar por escrito.</li>
        </ul>
      </div>
    </div>
  );
}
