"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
      <h2 className="text-xl font-semibold">No pudimos cargar esta sección</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Intenta nuevamente en unos segundos.</p>
      <button
        className="mt-6 rounded-xl bg-[var(--brand)] px-4 py-2 font-medium text-white"
        onClick={reset}
      >
        Reintentar
      </button>
    </div>
  );
}
