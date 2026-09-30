"use client";

import Image from "next/image";

import { experience, projects, stackGroups } from "@/content/data";
import { grepFor, shortLabel } from "@/lib/terminal/marks";
import type { Project, Role } from "@/lib/types";
import { useTerminal } from "./context";
import { stop } from "./identity";
import { TechMark } from "./tech-mark";

export type ResumeTab = "experience" | "projects" | "stack";

/** Only projects with a live site reach the shelf; `!ls projects/` still lists all of them. */
export const shelf: Project[] = projects.filter((p) => p.live);

export const TAB_COUNTS: Record<ResumeTab, number> = {
  experience: experience.length,
  projects: shelf.length,
  stack: stackGroups.reduce((n, g) => n + g.items.length, 0),
};

const TABS: [ResumeTab, string][] = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["stack", "Stack"],
];

export function TabStrip({ tab, onPick }: { tab: ResumeTab; onPick: (t: ResumeTab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="résumé sections"
      className="inline-flex gap-1 rounded-[14px] bg-white/[.04] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]"
    >
      {TABS.map(([id, label]) => {
        const on = id === tab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            className="t-reset inline-flex h-8 items-center gap-2 rounded-[11px] px-3.5 font-sans text-[13px] font-semibold transition-colors duration-150"
            style={{
              background: on ? "rgba(255,255,255,.07)" : "transparent",
              boxShadow: on ? "inset 0 0 0 1px rgba(255,255,255,.08)" : "none",
              color: on ? "var(--t-fg)" : "var(--t-muted)",
            }}
            onClick={stop(() => onPick(id))}
          >
            {label}
            <span className="font-mono text-[11px] tabular-nums" style={{ color: on ? "var(--t-accent)" : "var(--t-dim)" }}>
              {TAB_COUNTS[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RoleRow({ role, index, last, onOpen }: { role: Role; index: number; last: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="t-reset grid w-full flex-1 grid-cols-[14px_minmax(0,1fr)_auto] content-center items-start gap-4 overflow-hidden rounded-[14px] px-4 py-3.5 text-left transition-colors duration-150 hover:bg-white/[.05]"
      style={{ animation: `tRowIn .55s cubic-bezier(.2,.8,.2,1) ${index * 0.12}s both` }}
      onClick={stop(onOpen)}
    >
      <span className="relative flex justify-center self-stretch pt-[5px]">
        {index > 0 && <span className="absolute -top-3.5 bottom-[calc(100%-5px)] left-[calc(50%-.5px)] w-px bg-white/[.12]" />}
        {!last && (
          <span
            className="absolute -bottom-3.5 left-[calc(50%-.5px)] top-3.5 w-px origin-top"
            style={{ background: "linear-gradient(var(--t-accent),rgba(255,255,255,.12) 40%)", animation: `tLineIn .6s cubic-bezier(.2,.8,.2,1) ${0.25 + index * 0.12}s both` }}
          />
        )}
        <span
          className="relative size-[9px] flex-none rounded-full"
          style={
            role.current
              ? { background: "var(--t-accent)", boxShadow: "0 0 0 3px var(--t-hl)" }
              : { background: "var(--t-bg)", boxShadow: "inset 0 0 0 1.5px var(--t-dim)" }
          }
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 font-sans">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-tm-fg">
            {role.role} · {role.org}
          </span>
          {role.current && (
            <span className="inline-flex h-5 items-center rounded-full bg-tm-hl px-2 text-[10.5px] font-semibold text-tm-accent">Current</span>
          )}
        </span>
        <span className="text-[11.5px] text-tm-muted">
          {role.when}
          {role.client ? ` · client · ${role.client}` : ""}
        </span>
        <span className="max-w-[78ch] text-[12.5px] leading-[1.55] text-tm-sub [text-wrap:pretty]">{role.one}</span>
        <span className="flex flex-wrap items-center gap-1.5 pt-1.5">
          {role.stack.map((s, i) => (
            <span
              key={s}
              title={s}
              className="t-chip inline-flex size-7 items-center justify-center rounded-[9px]"
              style={{ animation: `tJump .6s cubic-bezier(.2,.8,.2,1) ${0.3 + (index * role.stack.length + i) * 0.04}s both` }}
            >
              <TechMark label={s} size={15} />
            </span>
          ))}
        </span>
      </span>
      <span className="pt-0.5 text-lg leading-none text-tm-dim">›</span>
    </button>
  );
}

function ProjectCard({ project, index, onOpen }: { project: Project; index: number; onOpen: () => void }) {
  const live = project.live;
  if (!live) return null;
  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-[18px] bg-white/[.035] shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_0_1px_rgba(255,255,255,.06)]"
      style={{ animation: `tTileIn .5s cubic-bezier(.2,.8,.2,1) ${index * 0.1}s both` }}
    >
      <div className="flex h-7 flex-none items-center gap-1.5 border-b border-white/[.06] px-2.5">
        <span className="inline-flex gap-1" aria-hidden>
          {["rgba(255,255,255,.18)", "rgba(255,255,255,.12)", "rgba(255,255,255,.12)"].map((c, i) => (
            <span key={i} className="size-[5px] rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="ml-1 inline-block size-1.5 flex-none rounded-full bg-tm-green" style={{ animation: "tBlink 1.1s steps(1,end) infinite" }} />
        <span className="truncate font-sans text-[10.5px] text-tm-muted">{live.host}</span>
      </div>
      <a href={live.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[16/10] bg-tm-bg" title={`open ${live.host}`}>
        <Image src={live.shot} alt={`${project.title} — screenshot of the live site`} fill sizes="(max-width: 1179px) 50vw, 300px" className="object-cover object-top" />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 font-sans">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[10.5px] uppercase tracking-[.06em] text-tm-muted">{project.label}</span>
          <span className="flex-none font-mono text-[11px] text-tm-dim">{project.year}</span>
        </div>
        <div className="text-sm font-semibold text-tm-fg">{project.title}</div>
        <div className="text-[12px] leading-[1.45] text-tm-sub [text-wrap:pretty]">{project.one}</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <a
            href={live.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-tm-accent px-3 text-[12px] font-semibold text-tm-bg no-underline hover:text-tm-bg"
          >
            Open live ↗
          </a>
          <button
            type="button"
            className="t-reset t-chip inline-flex h-8 items-center rounded-[10px] px-3 text-[12px] font-semibold text-tm-fg transition-colors duration-150 hover:bg-tm-hl hover:text-tm-accent"
            onClick={stop(onOpen)}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

function StackGrid() {
  const { submit } = useTerminal();
  return (
    <div className="flex flex-col gap-3">
      {stackGroups.map((g, gi) => (
        <div
          key={g.label}
          className="rounded-[18px] bg-white/[.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_0_1px_rgba(255,255,255,.06)]"
          style={{ animation: `tTileIn .5s cubic-bezier(.2,.8,.2,1) ${gi * 0.08}s both` }}
        >
          <div className="mb-2.5 font-sans text-[10.5px] font-semibold uppercase tracking-[.08em] text-tm-muted">{g.label}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(68px,1fr))" }}>
            {g.items.map((item) => (
              <button
                key={item}
                type="button"
                title={`${item} · where I used it`}
                className="t-reset t-chip flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 pb-2 pt-2.5 text-tm-sub transition-all duration-150 hover:-translate-y-px hover:bg-tm-hl hover:text-tm-accent"
                onClick={stop(() => submit(grepFor(item)))}
              >
                <TechMark label={item} size={20} />
                <span className="max-w-full truncate text-center font-sans text-[9.5px] leading-[1.15]">{shortLabel(item)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResumePaneBody({ tab }: { tab: ResumeTab }) {
  const { openDrawer } = useTerminal();
  if (tab === "experience")
    return (
      <div className="flex flex-1 flex-col rounded-[18px] bg-white/[.035] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_0_1px_rgba(255,255,255,.06)]">
        {experience.map((r, i) => (
          <RoleRow key={r.id} role={r} index={i} last={i === experience.length - 1} onOpen={() => openDrawer({ kind: "role", id: r.id })} />
        ))}
      </div>
    );
  if (tab === "projects")
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
        {shelf.map((p, i) => (
          <ProjectCard key={p.name} project={p} index={i} onOpen={() => openDrawer({ kind: "project", id: p.name })} />
        ))}
      </div>
    );
  return <StackGrid />;
}

/** Desktop: the left 44% of the split, a glass card of its own. Mobile renders the same body inside a bottom sheet. */
export function ResumePane({ tab, onPick }: { tab: ResumeTab; onPick: (t: ResumeTab) => void }) {
  return (
    <section
      data-screen-label="Recruiter panel"
      aria-label="résumé"
      className="t-glass flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-[20px] px-[18px] pb-5"
      style={{ flex: "0 0 min(44%, 600px)", animation: "tHeroIn .55s cubic-bezier(.2,.8,.2,1) .16s both" }}
    >
      <div
        className="sticky -top-px z-[3] -mx-[18px] mb-3.5 flex items-center gap-3 rounded-t-[20px] border-b border-white/[.05] px-[18px] pb-2.5 pt-4 backdrop-blur-xl"
        style={{ background: "color-mix(in oklch,var(--t-bg) 86%,transparent)" }}
      >
        <TabStrip tab={tab} onPick={onPick} />
      </div>
      <ResumePaneBody tab={tab} />
    </section>
  );
}
