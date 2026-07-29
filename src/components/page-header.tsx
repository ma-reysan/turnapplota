export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {actions}
    </header>
  );
}
