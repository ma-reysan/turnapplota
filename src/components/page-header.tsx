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
    <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">{description}</p>
      </div>
      {actions}
    </header>
  );
}
