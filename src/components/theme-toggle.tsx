"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      aria-label="Cambiar tema"
      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] transition hover:-translate-y-0.5"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      type="button"
    >
      <Moon className="dark:hidden" size={18} />
      <Sun className="hidden dark:block" size={18} />
    </button>
  );
}
