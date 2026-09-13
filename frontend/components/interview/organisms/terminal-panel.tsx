import { Eyebrow, Mono } from "@/components/ui/typography";
import { TypingCaret } from "@/components/ui/indicators";
import type { TerminalLine } from "@/lib/interview/types";

/** Always dark, in both themes: a terminal that follows the app's light theme
 * stops reading as a terminal. Colours here are therefore literal rather than
 * token-driven. */
const LINE_COLOR = {
  command: "text-[hsl(40_4%_60%)]",
  output: "text-[hsl(38_5%_71%)]",
  error: "text-[hsl(355_85%_69%)]",
  muted: "text-[hsl(40_4%_60%)]",
} as const;

export function TerminalPanel({
  title,
  subtitle,
  lines,
  exitCode,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Absent or empty means nothing has been run. The panel then shows a bare
   * prompt -- an empty terminal is what an unrun task actually has. */
  lines?: TerminalLine[];
  exitCode?: number;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-col bg-[hsl(30_7%_5%)] ${className ?? ""}`}>
      <div className="flex h-[30px] shrink-0 items-center gap-2.5 border-b border-[hsl(0_0%_100%/0.1)] px-3">
        <Eyebrow className="text-[hsl(0_0%_100%/0.5)]">{title}</Eyebrow>
        {subtitle && <Mono className="text-2xs text-[hsl(0_0%_100%/0.35)]">{subtitle}</Mono>}
        <div className="flex-1" />
        {exitCode !== undefined && (
          <Mono className={exitCode === 0 ? "text-2xs text-[hsl(151_51%_49%)]" : "text-2xs text-[hsl(355_85%_69%)]"}>
            exit {exitCode}
          </Mono>
        )}
      </div>

      <div className="scrollbar-thin t-mono min-h-0 flex-1 overflow-y-auto px-3 py-2.5 text-2xs leading-[1.75] text-[hsl(34_11%_88%)]">
        {(lines ?? []).map((line, index) => (
          <div key={index} className={LINE_COLOR[line.kind]}>
            {line.text}
          </div>
        ))}
        <div className="mt-1.5 text-[hsl(40_4%_60%)]">
          ${" "}
          <TypingCaret width={6} height={11} className="bg-[hsl(34_11%_88%)] align-[-1px]" />
        </div>
      </div>

      {footer}
    </div>
  );
}
