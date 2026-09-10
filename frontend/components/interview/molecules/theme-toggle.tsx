"use client";

import { useTheme } from "next-themes";
import { IconButton } from "@/components/ui/icon-button";
import { ThemeIcon } from "@/components/interview/icons";
import { useHydrated } from "@/lib/hooks/use-hydrated";

/** The glyph is identical in both themes, so only the tooltip needs the
 * hydration guard -- the server has no way to know the stored theme. */
export function ThemeToggle({ size = "sm" }: { size?: "default" | "sm" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const isDark = resolvedTheme === "dark";

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
