"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FileImage,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Stethoscope,
  TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/turnos", label: "Turnos", icon: CalendarDays },
  { href: "/reemplazos", label: "Reemplazos", icon: TableProperties },
  { href: "/analisis", label: "Análisis", icon: BarChart3 },
  { href: "/agenda-aps", label: "Agenda APS", icon: CalendarDays },
  { href: "/protocolos", label: "Protocolos", icon: BookOpen },
  { href: "/jefatura", label: "Jefatura", icon: LockKeyhole },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showingSchedule = pathname.startsWith("/turnos");
  const showingAgenda = pathname.startsWith("/agenda-aps");
  const [moreOpen, setMoreOpen] = useState(false);

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
        <div className="mt-auto space-y-2">
          {showingSchedule ? (
            <div className="rounded-xl border border-[var(--line)] p-2">
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
          {showingAgenda ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-xs font-medium hover:bg-[var(--surface-soft)]"
              onClick={() => window.dispatchEvent(new Event("turnapp:export-agenda-pdf"))}
              type="button"
            >
              <FileText size={15} /> Exportar PDF
            </button>
          ) : null}
          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-2">
            <span className="text-xs text-[var(--muted)]">Apariencia</span>
            <ThemeToggle />
          </div>
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
        {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => {
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
        <button className={cn("flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px]", moreOpen || pathname.startsWith("/protocolos") || pathname.startsWith("/jefatura") ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]")} onClick={() => setMoreOpen((value) => !value)} type="button"><MoreHorizontal size={18} />Más +</button>
      </nav>
      {moreOpen ? <div className="no-print fixed bottom-[88px] right-3 z-50 grid w-44 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl lg:hidden"><Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-[var(--surface-soft)]" href="/protocolos" onClick={() => setMoreOpen(false)}><BookOpen size={16} /> Protocolos</Link><Link className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-[var(--surface-soft)]" href="/jefatura" onClick={() => setMoreOpen(false)}><LockKeyhole size={16} /> Jefatura</Link>{showingAgenda ? <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-[var(--surface-soft)]" onClick={() => window.dispatchEvent(new Event("turnapp:export-agenda-pdf"))} type="button"><FileText size={16} /> Exportar PDF</button> : null}<div className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs"><span>Apariencia</span><ThemeToggle /></div></div> : null}
    </div>
  );
}
