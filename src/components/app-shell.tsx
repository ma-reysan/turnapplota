"use client";

import {
  BarChart3,
  CalendarDays,
  FileImage,
  FileText,
  LockKeyhole,
  Stethoscope,
  TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/turnos", label: "Turnos", icon: CalendarDays },
  { href: "/reemplazos", label: "Reemplazos", icon: TableProperties },
  { href: "/analisis", label: "Análisis", icon: BarChart3 },
  { href: "/jefatura", label: "Jefatura", icon: LockKeyhole },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showingSchedule = pathname.startsWith("/turnos");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[216px_1fr]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[216px] flex-col border-r border-[var(--line)] bg-[var(--surface)] px-3 py-4 lg:flex">
        <Link className="flex items-center gap-2.5 px-2 py-1.5" href="/turnos">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand)] text-white">
            <Stethoscope size={19} />
          </span>
          <span>
            <strong className="block tracking-tight">TurnApp</strong>
            <small className="text-[11px] text-[var(--muted)]">Urgencia · Lota</small>
          </span>
        </Link>
        <nav className="mt-5 space-y-1" aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-[var(--brand)] text-white shadow-lg shadow-emerald-950/10"
                    : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                )}
                href={href}
                key={href}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        {showingSchedule ? (
          <div className="mt-5 rounded-xl border border-[var(--line)] p-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Exportar
            </p>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-[var(--surface-soft)]"
              onClick={() => window.dispatchEvent(new Event("turnapp:export-image"))}
              type="button"
            >
              <FileImage size={15} /> Exportar imagen
            </button>
            <button
              className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-[var(--surface-soft)]"
              onClick={() => window.dispatchEvent(new Event("turnapp:export-pdf"))}
              type="button"
            >
              <FileText size={15} /> Exportar PDF
            </button>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-2">
          <span className="text-xs text-[var(--muted)]">Apariencia</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className="min-w-0 pb-24 lg:col-start-2 lg:pb-0">
        <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-5 lg:px-5 lg:py-5">
          {children}
        </div>
      </main>

      <nav
        aria-label="Navegación móvil"
        className="no-print fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl lg:hidden"
      >
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px]",
                active ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]",
              )}
              href={href}
              key={href}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
        <div className="grid place-items-center">
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}
