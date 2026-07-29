"use client";

import {
  BarChart3,
  CalendarDays,
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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[var(--line)] bg-[var(--surface)] px-4 py-5 lg:flex">
        <Link className="flex items-center gap-3 px-3 py-2" href="/turnos">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)] text-white">
            <Stethoscope size={22} />
          </span>
          <span>
            <strong className="block text-lg tracking-tight">TurnApp</strong>
            <small className="text-[var(--muted)]">Urgencia · Lota</small>
          </span>
        </Link>
        <nav className="mt-8 space-y-2" aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-[var(--brand)] text-white shadow-lg shadow-emerald-950/10"
                    : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                )}
                href={href}
                key={href}
              >
                <Icon size={19} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-3">
          <span className="text-xs text-[var(--muted)]">Apariencia</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className="min-w-0 pb-24 lg:col-start-2 lg:pb-0">
        <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
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
