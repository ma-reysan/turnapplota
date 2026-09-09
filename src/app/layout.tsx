import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AccentThemeProvider } from "@/components/accent-theme-provider";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TurnApp Lota",
  description: "Turnos y reemplazos de la Urgencia de Lota",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AccentThemeProvider>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="bottom-center" />
          </AccentThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
