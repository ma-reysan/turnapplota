import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Disclaimer · TurnApp Lota",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader eyebrow="Nota interna" title="Disclaimer" />

      <div className="glass rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
        <ul className="list-disc space-y-2 pl-5">
          <li>Aplicación diseñada por el Dr. Mauricio Reyes, con apoyo de Codex y Claude Code.</li>
          <li>
            Creé esta aplicación para apoyar la organización del trabajo de mis colegas en el
            hospital.
          </li>
          <li>Esta aplicación no tiene asociación oficial con el Hospital de Lota ni con su personal.</li>
          <li>
            Implementé sistemas que permiten mantener, actualizar y modificar la aplicación de
            forma autónoma, tanto por los colegas como por la jefatura de urgencia.
          </li>
          <li>
            No me responsabilizo por errores en la información o agenda que puedan producirse al
            utilizar la aplicación. Es importante mantener las bases de datos actualizadas.
          </li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">
          Changelog
        </h2>
        <ul className="space-y-1.5">
          <li><strong className="text-[var(--foreground)]">v1.03</strong> · Añadido Buscador en Agenda APS</li>
          <li><strong className="text-[var(--foreground)]">v1.02</strong> · Añadido Almuerzo</li>
          <li><strong className="text-[var(--foreground)]">v1.01</strong> · Añadido Teléfono</li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">
          Open Source
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Esta aplicación está desarrollada con React y Node.js, alojada en GitHub y desplegada en Vercel.</li>
          <li>El proyecto fue diseñado para que otros colegas puedan mantenerlo si fuera necesario.</li>
          <li>
            El código fuente está disponible públicamente en GitHub:{" "}
            <a
              className="font-medium text-[var(--brand)] underline underline-offset-2"
              href="https://github.com/ma-reysan/turnapplota"
              rel="noreferrer"
              target="_blank"
            >
              github.com/ma-reysan/turnapplota
            </a>
            .
          </li>
          <li>Puede descargarse, reutilizarse y modificarse según sea necesario.</li>
        </ul>
      </div>
    </div>
  );
}
