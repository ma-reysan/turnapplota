export function ReplacementStatus({
  emoji,
  label,
}: {
  emoji: string;
  label: string;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        aria-label={label}
        className="grid h-5 w-5 place-items-center rounded text-sm leading-none outline-none hover:bg-[var(--surface-soft)] focus:bg-[var(--surface-soft)]"
        type="button"
      >
        {emoji}
      </button>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--foreground)] px-2 py-1 text-[9px] font-medium text-[var(--background)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
