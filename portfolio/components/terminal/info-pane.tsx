"use client";

import Image from "next/image";
import { useState } from "react";

import { LINKS, SKILL_GRID, ICONS } from "@/lib/terminal/constants";
import { industry } from "@/lib/terminal/time";
import type { Source } from "@/lib/types";
import { useNow } from "./hooks";
import { FileIcon, GithubIcon, LinkedinIcon, MailIcon } from "./icons";
import { GreenDot } from "./entries/whoami";

const MONO: Record<string, string> = { SQL: "SQ" };

function UptimeClock() {
  const ind = industry(useNow());
  const rot = (deg: number) => `rotate(${deg} 50 50)`;
  return (
    <div className="flex items-center gap-3.5 border border-tm-border bg-tm-bg p-3">
      <svg viewBox="0 0 100 100" width="96" height="96" className="flex-none overflow-visible" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--t-border)" strokeWidth="1" />
        <g stroke="var(--t-dim)" strokeWidth="1.5">
          <line x1="50" y1="4" x2="50" y2="10" />
          <line x1="96" y1="50" x2="90" y2="50" />
          <line x1="50" y1="96" x2="50" y2="90" />
          <line x1="4" y1="50" x2="10" y2="50" />
        </g>
        <g stroke="var(--t-border)" strokeWidth="1">
          <line x1="73" y1="10.2" x2="70" y2="15.4" />
          <line x1="89.8" y1="27" x2="84.6" y2="30" />
          <line x1="89.8" y1="73" x2="84.6" y2="70" />
          <line x1="73" y1="89.8" x2="70" y2="84.6" />
          <line x1="27" y1="89.8" x2="30" y2="84.6" />
          <line x1="10.2" y1="73" x2="15.4" y2="70" />
          <line x1="10.2" y1="27" x2="15.4" y2="30" />
          <line x1="27" y1="10.2" x2="30" y2="15.4" />
        </g>
        <line x1="50" y1="50" x2="50" y2="26" stroke="var(--t-fg)" strokeWidth="3" strokeLinecap="round" transform={rot(((ind.el / 3600000) % 12) * 30)} />
        <line x1="50" y1="50" x2="50" y2="14" stroke="var(--t-fg)" strokeWidth="2" strokeLinecap="round" transform={rot(((ind.el / 60000) % 60) * 6)} />
        <line x1="50" y1="56" x2="50" y2="10" stroke="var(--t-accent)" strokeWidth="1" strokeLinecap="round" transform={rot((ind.seconds % 60) * 6)} />
        <circle cx="50" cy="50" r="2.4" fill="var(--t-accent)" />
      </svg>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-[.08em] text-tm-muted">in industry</div>
        <div className="mt-0.5 text-[22px] font-semibold leading-[1.15] text-tm-fg">
          {ind.years}
          <span className="text-xs font-normal text-tm-muted">y</span> {ind.days}
          <span className="text-xs font-normal text-tm-muted">d</span>
        </div>
        <div className="text-xs tracking-[.04em] text-tm-accent tabular-nums">{ind.clock}</div>
        <div className="mt-0.5 text-[10.5px] text-tm-muted tabular-nums">{ind.seconds.toLocaleString("en-US")} s</div>
        <div className="text-[10.5px] text-tm-dim">since Jun 2024</div>
      </div>
    </div>
  );
}

function SkillTile({ label, onRun }: { label: string; onRun: () => void }) {
  const [broken, setBroken] = useState(false);
  const slug = ICONS[label];
  const short = label.replace("hybrid BM25+dense", "BM25+dense");
  return (
    <button
      type="button"
      title={`${label} · !grep ${label.toLowerCase()} -r ~/`}
      className="t-reset flex min-w-0 flex-col items-center gap-1 border border-tm-border bg-tm-bg px-0.5 pb-[5px] pt-1.5 text-tm-sub transition-all duration-150 hover:-translate-y-px hover:border-tm-accent hover:bg-tm-hl hover:text-tm-accent"
      onClick={(ev) => {
        ev.stopPropagation();
        onRun();
      }}
    >
      <span className="relative inline-flex size-[18px] items-center justify-center">
        {slug && !broken ? (
          <Image
            src={`https://cdn.simpleicons.org/${slug}/ffffff`}
            alt=""
            width={16}
            height={16}
            unoptimized
            className="block opacity-85"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="inline-flex size-[18px] items-center justify-center rounded-[3px] border border-tm-border text-[9px] font-bold tracking-[.02em] text-tm-fg">
            {MONO[label] ?? label.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
          </span>
        )}
      </span>
      <span className="max-w-full truncate text-center text-[8.5px] leading-[1.1] tracking-[.02em]">{short}</span>
    </button>
  );
}

const linkTile =
  "flex items-center gap-2 border border-tm-border bg-tm-bg px-2.5 py-[7px] text-[11.5px] text-tm-sub no-underline transition-all duration-150 hover:border-tm-accent hover:bg-tm-hl hover:text-tm-accent";

export function InfoPane({
  sources,
  isMobile,
  onClose,
  onRun,
  onOpenResume,
}: {
  sources: Record<string, Source>;
  isMobile: boolean;
  onClose: () => void;
  onRun: (cmd: string) => void;
  onOpenResume: () => void;
}) {
  const tiles: [string, string, React.ReactNode, string][] = [
    [LINKS.github, "GitHub · NandishNaik01", <GithubIcon key="g" size={14} />, "github"],
    [LINKS.linkedin, "LinkedIn · in/nandishd", <LinkedinIcon key="l" size={13} />, "linkedin"],
    [`mailto:${LINKS.email}`, LINKS.email, <MailIcon key="m" size={14} />, "email"],
    [LINKS.resume, "Résumé (PDF)", <FileIcon key="f" />, "résumé.pdf"],
  ];
  return (
    <aside
      data-screen-label="Info pane"
      aria-label="about Nandisha"
      className="flex min-h-0 flex-col bg-tm-panel"
      style={
        isMobile
          ? { position: "absolute", left: 0, right: 0, top: 30, bottom: 0, zIndex: 30, borderTop: "1px solid var(--t-border)", animation: "tSlideUp .3s cubic-bezier(.2,.8,.2,1)" }
          : { width: 312, flex: "none", borderLeft: "1px solid var(--t-border)" }
      }
    >
      <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
        <span>nandisha</span>
        <span className="flex-1" />
        {isMobile && (
          <button type="button" aria-label="close info" className="t-reset px-2 text-[13px] text-tm-muted" onClick={onClose}>
            ✕
          </button>
        )}
        <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-tm-green">
          <GreenDot />
          open to work
        </span>
      </div>
      <div className="grid flex-none grid-cols-2 gap-1.5 px-3.5 pt-3">
        {tiles.map(([href, title, icon, label]) => (
          <a key={label} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer" title={title} className={linkTile}>
            <span className="inline-flex w-3.5 justify-center">{icon}</span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-tm-dim">↗</span>
          </a>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-3.5 pb-3.5 pt-4">
        <div className="-mb-2.5 flex items-baseline justify-between">
          <span className="text-[10.5px] uppercase tracking-[.08em] text-tm-muted">uptime</span>
        </div>
        <UptimeClock />
        <div className="-mb-2.5 flex items-baseline justify-between">
          <span className="text-[10.5px] uppercase tracking-[.08em] text-tm-muted">résumé</span>
        </div>
        <button
          type="button"
          title="open résumé"
          className="t-reset relative box-border flex aspect-[210/297] w-full flex-none flex-col items-stretch justify-start overflow-hidden border border-tm-border px-3.5 pt-3.5 text-left font-sans transition-[box-shadow,border-color] duration-200 hover:border-tm-accent hover:shadow-[0_0_28px_var(--t-hl)]"
          style={{ background: "hsl(40 16% 96%)", color: "hsl(40 6% 10%)" }}
          onClick={(ev) => {
            ev.stopPropagation();
            onOpenResume();
          }}
        >
          <div className="font-serif text-[13px] leading-[1.1]">Nandisha D</div>
          <div className="mt-0.5 text-[6px]" style={{ color: "hsl(36 5% 40%)" }}>
            Generative AI Engineer · LLM Systems, RAG Pipelines &amp; Agentic AI
          </div>
          <div className="text-[5px]" style={{ color: "hsl(38 4% 50%)" }}>
            Bangalore, India · naik.nandishd@gmail.com · linkedin.com/in/nandishd · github.com/NandishNaik01
          </div>
          <div className="mb-[5px] mt-1.5 h-px" style={{ background: "hsl(34 11% 88%)" }} />
          <div className="text-justify text-[5px] leading-[1.5]">{sources["resume-summary"]?.text}</div>
          <div className="mt-1.5 text-[6px] font-semibold">Experience</div>
          <div className="text-[5px] leading-[1.5]">Think41 — Intern → SDE-I → SDE-II · Jun 2024 – Present</div>
          <div className="text-justify text-[5px] leading-[1.5]" style={{ color: "hsl(36 5% 40%)" }}>
            {sources["resume-sde2"]?.text}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-14" style={{ background: "linear-gradient(to bottom,transparent,hsl(40 16% 96%) 70%)" }} />
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="border bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.08em]" style={{ color: "hsl(36 5% 40%)", borderColor: "hsl(34 11% 88%)" }}>
              résumé · click to enlarge
            </span>
          </div>
        </button>
        <div className="flex flex-col gap-2.5">
          {SKILL_GRID.map((g) => (
            <div key={g.k} className="flex flex-col gap-[5px]">
              <div className="text-[10px] uppercase tracking-[.08em] text-tm-muted">{g.k}</div>
              <div className="grid grid-cols-4 gap-1">
                {g.items.map((label) => (
                  <SkillTile
                    key={label}
                    label={label}
                    onRun={() => onRun("!grep " + label.split(" ")[0].toLowerCase().replace(/[^a-z0-9.+-]/g, "") + " -r ~/")}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
