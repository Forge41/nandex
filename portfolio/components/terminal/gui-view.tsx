"use client";

import { Badge } from "@nandex/ui/badge";
import { Tag } from "@nandex/ui/tag";
import Image from "next/image";

import { projects } from "@/content/data";
import { LINKS } from "@/lib/terminal/constants";
import type { Source } from "@/lib/types";
import { experience } from "./overlays";

const btn = "inline-flex cursor-pointer items-center rounded-sm px-3 py-1.5 text-sm font-medium no-underline transition-colors";
const primary = `${btn} bg-btn-inverted text-content-on-interactive hover:bg-btn-inverted-hover`;
const secondary = `${btn} border border-line-strong bg-btn-neutral text-content hover:bg-btn-neutral-hover`;
const ghost = `${btn} text-content hover:bg-surface-hover`;

export function GuiView({
  byId,
  skills,
  onExit,
}: {
  byId: Record<string, Source>;
  skills: { k: string; items: string[] }[];
  onExit: () => void;
}) {
  return (
    <div
      data-screen-label="GUI view"
      role="dialog"
      aria-label="portfolio, plain view"
      className="light absolute inset-0 z-[36] overflow-auto bg-background font-sans text-[14px] leading-[1.5] text-content"
      style={{ animation: "tFade .25s" }}
    >
      <div className="mx-auto flex max-w-[860px] flex-col gap-11 px-7 pb-20 pt-12 max-[859px]:px-4 max-[859px]:pt-8">
        <header className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="t-eyebrow text-content-muted">Portfolio</span>
            <button type="button" autoFocus className={`${secondary} px-2.5 py-1 text-xs`} onClick={onExit}>
              Open terminal
            </button>
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <Image src="/profile.png" alt="Nandisha D" width={96} height={96} className="size-24 flex-none rounded-lg object-cover" />
            <div className="min-w-[min(240px,100%)] flex-1">
              <h1 className="t-title mb-1.5">Nandisha D</h1>
              <div className="t-body-md text-content-subtle">Generative AI Engineer · SDE-II at Think41, embedded with Harvey.ai · Bangalore</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="success">Open to interesting work</Badge>
                <Badge tone="neutral">2+ yrs · LLM systems</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`mailto:${LINKS.email}`} className={primary}>
                  Email
                </a>
                <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" className={secondary}>
                  LinkedIn
                </a>
                <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className={secondary}>
                  GitHub
                </a>
                <a href={LINKS.resume} target="_blank" className={ghost}>
                  Résumé (PDF)
                </a>
              </div>
            </div>
          </div>
          <p className="t-body-md max-w-[66ch] text-pretty text-content-subtle">
            I ship production LLM systems: retrieval pipelines that cite their sources, multi-agent workflows that persist on Temporal, MCP tooling that
            turns any API into agent tools, and voice pipelines on LiveKit. Treats prompts as production code.
          </p>
        </header>

        <section className="flex flex-col gap-3.5">
          <h2 className="t-h3">Experience</h2>
          <div className="flex flex-col border-t border-line">
            {experience(byId).map((x) => (
              <div key={x.title} className="grid gap-x-5 gap-y-1.5 border-b border-line py-3.5 sm:grid-cols-[150px_1fr]">
                <div className="t-small text-content-muted">{x.when}</div>
                <div>
                  <div className="font-medium">{x.title}</div>
                  <div className="t-small mt-1 text-pretty text-content-subtle">{x.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="t-h3">Projects</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(250px,100%),1fr))" }}>
            {projects.map((p) => (
              <div key={p.name} className="flex flex-col gap-1.5 rounded-md bg-surface-subtle p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{p.title}</div>
                  <span className="t-xs text-content-muted">{p.year}</span>
                </div>
                <div className="t-small text-pretty text-content-subtle">{p.one}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.stack.map((s) => (
                    <Tag key={s} variant="outline" className="text-xs">
                      {s}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="t-h3">Skills</h2>
          <div className="flex flex-col gap-2.5">
            {skills.map((g) => (
              <div key={g.k} className="grid gap-x-5 gap-y-1.5 sm:grid-cols-[150px_1fr]">
                <div className="t-small text-content-muted">{g.k}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((s) => (
                    <Badge key={s} tone="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="t-h3">Education</h2>
          <div className="t-small text-content-subtle">B.E. Computer Science &amp; Engineering, 2020 – 2024 · Shivamogga, Karnataka</div>
          <div className="t-small text-content-subtle">
            Anthropic Academy (Jul 2026): Intro to MCP · Intro to Agent Skills · Claude Code in Action · Building with the Claude API
          </div>
        </section>
      </div>
    </div>
  );
}
