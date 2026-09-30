"use client";

import { experience, projects } from "@/content/data";
import { LINKS } from "@/lib/terminal/constants";
import type { Project, Role } from "@/lib/types";
import { useTerminal } from "./context";
import { stop } from "./identity";
import { TechMark } from "./tech-mark";

export type DrawerTarget = { kind: "role" | "project"; id: string };

type Detail = {
  eyebrow: string;
  title: string;
  summary: string;
  did: string[];
  stack: string[];
  src: string;
  live?: { url: string; host: string };
  repo?: string;
  ask: string;
};

const fromRole = (r: Role): Detail => ({
  eyebrow: `ROLE · ${r.when}`,
  title: r.client ? `${r.role} · ${r.org} → ${r.client}` : `${r.role} · ${r.org}`,
  summary: r.one,
  did: r.did,
  stack: r.stack,
  src: r.src,
  ask: r.client ? `what did you build for ${r.client}?` : `what did you do as ${r.role} at ${r.org}?`,
});

const fromProject = (p: Project): Detail => ({
  eyebrow: `PROJECT · ${p.year}`,
  title: p.title,
  summary: p.one,
  did: p.did ?? [],
  stack: p.stack,
  src: p.src,
  live: p.live,
  repo: p.repo,
  ask: `tell me about ${p.title}`,
});

function detailFor(target: DrawerTarget): Detail | null {
  if (target.kind === "role") {
    const r = experience.find((x) => x.id === target.id);
    return r ? fromRole(r) : null;
  }
  const p = projects.find((x) => x.name === target.id);
  return p ? fromProject(p) : null;
}

const action =
  "t-chip inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 font-sans text-[12.5px] font-semibold text-tm-fg no-underline transition-colors duration-150 hover:bg-tm-hl hover:text-tm-accent";

export function DetailDrawer({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
  const { byId, submit, openPane } = useTerminal();
  const d = detailFor(target);
  if (!d) return null;
  const doc = byId[d.src];

  const ask = () => {
    onClose();
    submit(d.ask);
  };

  return (
    <div
      data-screen-label="Detail drawer"
      className="absolute inset-0 z-[42] flex justify-end bg-black/55"
      style={{ animation: "tFade .2s" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.title}
        className="flex min-h-0 w-[min(520px,100%)] flex-col bg-tm-panel shadow-[0_0_80px_rgba(0,0,0,.6)] max-[859px]:w-full"
        style={{ animation: "tSlideIn .3s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex flex-none items-start gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[10.5px] font-semibold uppercase tracking-[.08em] text-tm-muted">{d.eyebrow}</div>
            <h2 className="m-0 mt-1.5 font-sans text-[22px] font-bold leading-[1.15] tracking-[-.02em] text-tm-fg">{d.title}</h2>
            {doc && (
              <button
                type="button"
                className="t-reset mt-1.5 text-[11.5px] text-tm-dim underline decoration-dotted hover:text-tm-accent"
                title="open this source"
                onClick={stop(() => openPane(d.src))}
              >
                {doc.doc} › {doc.title}
              </button>
            )}
          </div>
          <button
            type="button"
            autoFocus
            aria-label="close"
            className="t-reset t-chip inline-flex size-8 flex-none items-center justify-center rounded-full text-tm-muted hover:text-tm-accent"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 pb-4 font-sans">
          <p className="m-0 text-[13px] leading-[1.55] text-tm-sub [text-wrap:pretty]">{d.summary}</p>

          {d.did.length > 0 && (
            <div>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-tm-muted">What I did</div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {d.did.map((line) => (
                  <li key={line} className="flex gap-2.5 text-[12.5px] leading-[1.5] text-tm-fg [text-wrap:pretty]">
                    <span className="mt-1.5 inline-block size-1.5 flex-none rounded-full bg-tm-accent" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-tm-muted">Stack</div>
            <div className="flex flex-wrap gap-1.5">
              {d.stack.map((s) => (
                <span key={s} className="t-chip inline-flex h-7 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-[11.5px] text-tm-sub">
                  <TechMark label={s} size={14} />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-none flex-wrap gap-2 border-t border-tm-border p-4">
          <button
            type="button"
            className="t-reset inline-flex h-9 items-center rounded-xl bg-tm-accent px-3.5 font-sans text-[12.5px] font-semibold text-tm-bg shadow-[0_6px_18px_var(--t-hl)] transition-transform duration-150 hover:-translate-y-px"
            onClick={stop(ask)}
          >
            Ask about this
          </button>
          {d.live && (
            <a href={d.live.url} target="_blank" rel="noopener noreferrer" className={action}>
              Open live site ↗
            </a>
          )}
          {d.repo && (
            <a href={d.repo} target="_blank" rel="noopener noreferrer" className={action}>
              View source
            </a>
          )}
          <button
            type="button"
            className={`t-reset ${action}`}
            onClick={stop(() => {
              onClose();
              submit("/book");
            })}
          >
            Book a call
          </button>
          <span className="flex-1" />
          <a href={LINKS.resumeDownload} target="_blank" rel="noopener noreferrer" className={action}>
            Résumé
          </a>
        </div>
      </div>
    </div>
  );
}
