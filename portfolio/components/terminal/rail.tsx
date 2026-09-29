"use client";

import { LINKS } from "@/lib/terminal/constants";
import { uptime } from "@/lib/terminal/time";
import { GreenDot } from "./entries/whoami";
import { useNow } from "./hooks";
import { ChevronLeftIcon, FileIcon, GithubIcon, GridIcon, LinkedinIcon, MailIcon } from "./icons";

const tile =
  "t-reset flex size-10 items-center justify-center rounded-xl text-tm-sub no-underline shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] transition-all duration-150 bg-white/[.04] hover:bg-tm-hl hover:text-tm-accent";

export function Rail({ onExpand, onResume }: { onExpand: () => void; onResume: () => void }) {
  const now = useNow();
  const stop = (fn: () => void) => (ev: React.MouseEvent) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <aside data-screen-label="Rail" aria-label="quick links" className="flex min-h-0 w-14 flex-none flex-col items-center border-l border-tm-border bg-tm-panel">
      <button
        type="button"
        title="expand info"
        aria-label="expand info pane"
        className="t-reset flex h-[30px] w-14 items-center justify-center border-b border-tm-border text-tm-muted transition-colors duration-150 hover:text-tm-accent"
        onClick={stop(onExpand)}
      >
        <ChevronLeftIcon />
      </button>
      <div className="flex flex-col items-center gap-1 py-2.5">
        <button
          type="button"
          title="résumé"
          aria-label="open résumé"
          className="t-reset flex size-10 items-center justify-center rounded-xl bg-tm-accent text-tm-bg shadow-[0_6px_16px_var(--t-hl)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_0_18px_var(--t-hl)]"
          onClick={stop(onResume)}
        >
          <FileIcon size={16} />
        </button>
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub" className={tile}>
          <GithubIcon size={16} />
        </a>
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className={tile}>
          <LinkedinIcon size={15} />
        </a>
        <a href={`mailto:${LINKS.email}`} title="Email" aria-label="Email" className={tile}>
          <MailIcon size={16} />
        </a>
        <button type="button" title="skills" aria-label="show skills" className={tile} onClick={stop(onExpand)}>
          <GridIcon />
        </button>
      </div>
      <span className="flex-1" />
      <div className="flex flex-col items-center gap-2 pb-3 pt-2.5" title="open to work">
        <GreenDot />
        <span className="rotate-180 whitespace-nowrap text-[10px] uppercase tracking-[.1em] text-tm-muted [writing-mode:vertical-rl]">{now ? uptime(now) : ""}</span>
      </div>
    </aside>
  );
}
