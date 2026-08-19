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
          <li>App diseñada por el Dr. Mauricio Reyes. Creada con ayuda de Codex y Claude Code.</li>
          <li>
            Creé esta aplicación para ayudar a la organización de mis colegas médicos del
            hospital.
          </li>
          <li>
            Esta aplicación no tiene ninguna asociación oficial con el Hospital de Lota ni con su
            personal.
          </li>
          <li>
            Implementé sistemas para que la app sea actualizable, autosostenible y modificable
            por los mismos colegas y el jefe de urgencia.
          </li>
          <li>
            No soy responsable de errores de información o agenda que ocurran al utilizar la app
            o la información que aparece en ella. Recordar mantener las bases de datos
            actualizadas.
          </li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">
          Open Source
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Esta es una app basada en React y Node.js, alojada en GitHub y desplegada en Vercel.</li>
          <li>El objetivo de este proyecto es que pueda ser mantenido por otros colegas si lo encuentran necesario.</li>
          <li>
            El código de la app está de forma pública en mi GitHub:{" "}
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
          <li>Se puede sacar de ahí y recrear o modificar. Una IA puede hacerlo sin problemas.</li>
        </ul>
      </div>
    </div>
  );
}
