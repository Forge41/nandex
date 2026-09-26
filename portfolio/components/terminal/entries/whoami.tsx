"use client";

import { LiveDot } from "@nandex/ui/indicators";
import Image from "next/image";
import { useMemo, useState } from "react";

import { sampleGrid, streaks } from "@/lib/github";
import { LINKS } from "@/lib/terminal/constants";
import { industry } from "@/lib/terminal/time";
import { ContribGraph } from "../contrib-graph";
import { useTerminal, useTerminalView } from "../context";
import { useNow } from "../hooks";
import { DownloadIcon, GithubIcon, LinkedinIcon, MailIcon, PinIcon, ShareIcon } from "../icons";
import { PhosphorPortrait } from "../phosphor-portrait";

export const GreenDot = ({ size = 6 }: { size?: number }) => (
  <LiveDot tone="success" size={size} style={{ background: "var(--t-green)", animationDuration: "1.4s" }} />
);

const statBtn =
  "t-reset min-w-0 flex-[1_1_110px] bg-tm-panel px-2.5 py-2 transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-tm-hl";
const statLabel = "whitespace-nowrap text-[10.5px] uppercase tracking-[.06em] text-tm-muted";
const linkBtn =
  "inline-flex items-center justify-center gap-1.5 border border-tm-border px-2 py-[5px] text-tm-sub no-underline transition-all duration-150 hover:border-tm-accent hover:text-tm-accent";

function Stats() {
  const { submit, randomCommit } = useTerminal();
  const { prCount, skillCount, isMobile } = useTerminalView();
  const ind = industry(useNow());
  const stop = (fn: () => void) => (ev: React.MouseEvent) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <div
      className="border border-tm-border bg-tm-border"
      style={isMobile ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 } : { display: "flex", flexWrap: "wrap", gap: 1 }}
    >
      <button type="button" title="!uptime" className={statBtn} onClick={stop(() => submit("!uptime"))}>
        <div className="whitespace-nowrap text-base font-semibold leading-[1.2]">
          {ind.years}
          <span className="text-[11px] font-normal text-tm-muted">y</span> {ind.days}
          <span className="text-[11px] font-normal text-tm-muted">d</span>
        </div>
        <div className={statLabel}>
          in industry <span className="text-tm-dim">›</span>
        </div>
      </button>
      <button type="button" title="!ls projects/" className={statBtn} onClick={stop(() => submit("!ls projects/"))}>
        <div className="text-base font-semibold leading-[1.2]">7</div>
        <div className={statLabel}>
          projects <span className="text-tm-dim">›</span>
        </div>
      </button>
      <button type="button" title="insert a commit" className={statBtn} onClick={stop(() => randomCommit("pr"))}>
        <div className="text-base font-semibold leading-[1.2] tabular-nums">
          {prCount.toLocaleString("en-US")}
          <span className="text-tm-accent">+</span>
        </div>
        <div className={statLabel}>
          merged PRs <span className="text-tm-green">++</span>
        </div>
      </button>
      <button type="button" title="insert a commit" className={statBtn} onClick={stop(() => randomCommit("skill"))}>
        <div className="text-base font-semibold leading-[1.2] tabular-nums">
          {skillCount.toLocaleString("en-US")}
          <span className="text-tm-accent">+</span>
        </div>
        <div className={statLabel}>
          skills <span className="text-tm-green">++</span>
        </div>
      </button>
    </div>
  );
}

function Portrait() {
  const { openVoice } = useTerminal();
  const { theme, isMobile } = useTerminalView();
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      title="tap to talk"
      className="t-reset flex flex-col items-center gap-1.5"
      onClick={(ev) => {
        ev.stopPropagation();
        openVoice();
      }}
    >
      <div
        onMouseMove={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          setLens({ x: ev.clientX - r.left, y: ev.clientY - r.top });
        }}
        onMouseLeave={() => setLens(null)}
        style={isMobile ? { position: "relative", width: 150, height: 150, margin: "0 auto" } : { position: "relative", width: 232, height: 232 }}
      >
        <PhosphorPortrait
          theme={theme}
          className="size-full shadow-[0_0_0_1px_var(--t-border),0_0_36px_var(--t-hl)] transition-shadow duration-200 hover:shadow-[0_0_0_1px_var(--t-accent),0_0_48px_var(--t-hl)]"
        />
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden bg-tm-bg"
          style={{
            clipPath: lens ? `circle(38px at ${lens.x}px ${lens.y}px)` : "circle(0px at 50% 50%)",
            transition: lens ? "none" : "clip-path .25s ease",
          }}
        >
          <Image
            src="https://cdn.simpleicons.org/claude/D97757"
            alt=""
            width={150}
            height={150}
            unoptimized
            className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
            style={{ filter: "drop-shadow(0 0 18px rgba(217,119,87,.6))" }}
          />
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">
        <GreenDot />
        tap to talk
      </span>
    </button>
  );
}

export function Whoami() {
  const { openVoice, openShare } = useTerminal();
  const { isMobile, contrib, theme } = useTerminalView();
  const sample = useMemo(() => sampleGrid(), []);
  const grid = contrib ?? sample;
  const st = useMemo(() => streaks(grid), [grid]);

  return (
    <div
      style={
        isMobile
          ? { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 14, padding: "6px 0 2px" }
          : { display: "flex", flexWrap: "wrap", gap: "8px 28px", alignItems: "flex-start", padding: "6px 0 2px" }
      }
    >
      <Portrait />
      <div
        style={
          isMobile
            ? { display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5, animation: "tReveal .5s ease-out" }
            : {
                minWidth: "min(100%,340px)",
                flex: "1 1 340px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                minHeight: 232,
                fontSize: 12.5,
                animation: "tReveal .5s ease-out",
              }
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-semibold leading-[1.2]">Nandisha D</div>
            <div className="text-tm-sub">Generative AI Engineer · Think41 → Harvey.ai</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap border border-tm-border px-2 py-0.5 text-[11px] text-tm-green">
              <GreenDot />
              {isMobile ? "open to work" : "open to interesting work"}
            </span>
            <button
              type="button"
              title="share this portfolio"
              aria-label="share this portfolio"
              className="t-reset inline-flex size-[26px] items-center justify-center border border-tm-border text-tm-sub transition-all duration-150 hover:border-tm-accent hover:bg-tm-hl hover:text-tm-accent"
              onClick={(ev) => {
                ev.stopPropagation();
                openShare();
              }}
            >
              <ShareIcon />
            </button>
          </div>
        </div>
        <Stats />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">
            <span className="truncate">github · last 52 weeks</span>
            <span className="text-tm-dim">{contrib ? "live" : "sample data · offline"}</span>
          </div>
          <ContribGraph grid={grid} theme={theme} />
          <div className="flex flex-wrap gap-4 text-[11.5px] text-tm-muted">
            <span>
              <span className="text-tm-green">▪</span> {st.now} day streak
            </span>
            <span>longest {st.max}</span>
            <span>{st.total} contributions</span>
          </div>
        </div>
        <div
          className="border-t border-dashed border-tm-border pt-2 text-[11.5px] text-tm-sub"
          style={isMobile ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } : { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          {!isMobile && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-tm-muted">
              <PinIcon />
              Bangalore · UTC+5:30
            </span>
          )}
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" className={linkBtn}>
            <GithubIcon />
            github
          </a>
          <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" className={linkBtn}>
            <LinkedinIcon />
            linkedin
          </a>
          <a href={`mailto:${LINKS.email}`} title="Email" className={linkBtn}>
            <MailIcon />
            email
          </a>
          <a
            href={LINKS.resume}
            target="_blank"
            title="Download résumé"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-tm-accent bg-tm-accent px-3 py-[5px] font-semibold text-tm-bg no-underline shadow-[0_0_16px_var(--t-hl)] transition-all duration-150 hover:-translate-y-px hover:text-tm-bg hover:shadow-[0_0_28px_var(--t-hl)]"
          >
            <DownloadIcon />
            résumé.pdf
          </a>
        </div>
      </div>
      {!isMobile && (
        <button
          type="button"
          title="voice mode"
          className="t-reset box-border flex h-[232px] w-[72px] flex-col items-center justify-center gap-2.5 self-start overflow-hidden whitespace-nowrap border border-tm-accent bg-tm-hl px-3 text-tm-accent shadow-[0_0_32px_var(--t-hl)] transition-transform duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:translate-x-2.5"
          onClick={(ev) => {
            ev.stopPropagation();
            openVoice();
          }}
        >
          <span className="text-[40px] font-light leading-none">›</span>
          <span className="rotate-180 text-[11px] uppercase tracking-[.14em] [writing-mode:vertical-rl]">let&apos;s go voice mode</span>
        </button>
      )}
    </div>
  );
}
