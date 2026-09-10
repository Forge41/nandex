"use client";

import { useTheme } from "next-themes";
import { IconButton } from "@/components/ui/icon-button";
import { ThemeIcon } from "@/components/interview/icons";
import { DEFAULT_THEME } from "@/components/theme-provider";
import { useHydrated } from "@/lib/hooks/use-hydrated";

/** Reads `theme` rather than `resolvedTheme`, and falls back to the configured
 * default: `resolvedTheme` is undefined until next-themes has resolved, which
 * made the first click after a fresh load a no-op.
 *
 * The glyph is identical in both themes, so only the tooltip needs the
 * hydration guard -- the server can't know the stored theme. */
export function ThemeToggle({ size = "sm" }: { size?: "default" | "sm" }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const isDark = (theme ?? DEFAULT_THEME) !== "light";

  return (
    <IconButton
      size={size}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={hydrated ? (isDark ? "Switch to light" : "Switch to dark") : undefined}
      aria-label="Toggle theme"
    >
      <ThemeIcon width={14} height={14} />
    </IconButton>
  );
}
