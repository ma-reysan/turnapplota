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
          Código abierto
        </h2>
        <p>
          Este proyecto es de código abierto: voy a dejar el repositorio de GitHub público, para
          que cualquier colega interesado pueda ver cómo está hecha la aplicación por dentro. No
          hace falta saber de informática para mirarlo. Si en el futuro algún colega tiene
          conocimientos de programación, o simplemente ganas de aprender, puede entrar al
          repositorio, revisar el código y hacer sus propios cambios o mejoras. La idea es que la
          app no dependa de una sola persona: cualquiera con los conocimientos necesarios puede
          tomar la posta, corregir errores o agregar funciones nuevas cuando haga falta.
        </p>
      </div>
    </div>
  );
}
