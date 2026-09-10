"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

export const DEFAULT_THEME = "dark";

/** Binary light/dark only -- the interview room's rail toggle has no "system"
 * position, so exposing one would make the toggle lie about its own state. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme={DEFAULT_THEME} enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  );
}
