"use client";

import { forwardRef, useEffect, useState } from "react";

import { modeOf, PROMPT_COLOR, PROMPT_SYMBOL } from "@/lib/commands/parse";
import type { TerminalAction } from "@/lib/terminal/reducer";
import { acItems, needsArg, type AcItem } from "@/lib/terminal/suggest";
import { MicIcon, SendIcon } from "./icons";

type PromptProps = {
  input: string;
  acIdx: number;
  fitPending: boolean;
  sudoPending: boolean;
  thinking: boolean;
  showLanding: boolean;
  ghost: string;
  suggestions: string[];
  isMobile: boolean;
  dispatch: React.Dispatch<TerminalAction>;
  submit: (text: string) => void;
  runSuggestion: (text: string) => void;
  onShortcuts: () => void;
  onVoice: () => void;
};

const kbd = "flex-none border border-tm-border px-[5px] text-[10px] text-tm-muted";
const withArgSpace = (fill: string) => fill + (fill.includes(" ") || /theme|cat|grep/.test(fill) ? " " : "");

export const Prompt = forwardRef<HTMLInputElement, PromptProps>(function Prompt(
  { input, acIdx, fitPending, sudoPending, thinking, showLanding, ghost, suggestions, isMobile, dispatch, submit, runSuggestion, onShortcuts, onVoice },
  inputRef,
) {
  // The chips stagger in once. The row rotates every few seconds, and replaying the entrance
  // on each rotation would blank the row for a third of a second each time.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(id);
  }, []);
  const flags = { fitPending, sudoPending };
  const mode = modeOf(input, flags);
  const ac = acItems(input, flags);
  const open = ac.length > 0;
  const current = (): AcItem => ac[Math.min(acIdx, ac.length - 1)];
  const setInput = (value: string) => dispatch({ type: "INPUT", value });

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      const typed = input.trim().toLowerCase();
      if (open) {
        const it = current();
        const exact = ac.some((a) => a.fill.toLowerCase() === typed || a.name.toLowerCase() === typed);
        if (!exact && !needsArg(it)) return submit(it.fill);
        if (!exact && needsArg(it)) return setInput(it.fill + " ");
      }
      return submit(input);
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      if (!input) {
        if (ghost) setInput(ghost);
        return;
      }
      if (open) setInput(withArgSpace(current().fill));
      return;
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const dir = ev.key === "ArrowDown" ? 1 : -1;
      if (open) dispatch({ type: "AC_MOVE", delta: dir, count: ac.length });
      else dispatch({ type: "HISTORY", dir });
      return;
    }
    if (ev.key === "Escape" && open) setInput("");
    if (ev.key === "ArrowRight" && !input && ghost) {
      ev.preventDefault();
      setInput(ghost);
    }
    if (ev.key === "?" && !input) {
      ev.preventDefault();
      onShortcuts();
    }
  };

  return (
    <div className="relative z-[1] flex-none border-t border-tm-border bg-tm-bg">
      {open && (
        <div
          id="t-autocomplete"
          role="listbox"
          aria-label={input[0] === "!" ? "shell commands" : "slash commands"}
          className="absolute bottom-[calc(100%+6px)] left-3.5 z-[5] max-h-[280px] w-[min(520px,calc(100%-28px))] overflow-auto border border-tm-border bg-tm-panel shadow-[0_12px_40px_rgba(0,0,0,.5)]"
        >
          <div className="border-b border-tm-border px-2.5 py-[5px] text-[10.5px] uppercase tracking-[.08em] text-tm-dim">
            {input[0] === "!" ? "shell" : "commands"} · tab to complete
          </div>
          {ac.map((a, i) => (
            <div
              key={a.name}
              id={`t-ac-${i}`}
              role="option"
              aria-selected={i === acIdx}
              className="flex cursor-pointer gap-3 px-2.5 py-[5px] text-[12.5px]"
              style={{
                background: i === acIdx ? "var(--t-sel)" : "transparent",
                borderLeft: "2px solid " + (i === acIdx ? "var(--t-accent)" : "transparent"),
              }}
              onMouseDown={(ev) => {
                ev.preventDefault();
                setInput(a.fill + (/theme|cat|grep/.test(a.fill) ? " " : ""));
              }}
            >
              <span className="flex-none text-tm-fg sm:min-w-[200px]">{a.name}</span>
              <span className="truncate text-tm-muted">{a.desc}</span>
            </div>
          ))}
        </div>
      )}
      {showLanding && (
        <div className="flex flex-col gap-1.5 px-[18px] pt-2 max-[859px]:px-2.5" style={{ animation: "tFade .3s" }}>
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[.1em] text-tm-dim">Suggested questions</span>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {suggestions.slice(0, 6).map((t, i) => (
              <button
                key={t}
                type="button"
                className="t-reset t-chip flex h-[31px] flex-none items-center rounded-full px-[13px] font-sans text-[12.5px] text-tm-sub transition-[background,color] duration-200 hover:bg-tm-hl hover:text-tm-fg"
                style={intro ? { animation: `tChipIn .45s cubic-bezier(.2,.8,.2,1) ${0.35 + i * 0.07}s both` } : undefined}
                onClick={(ev) => {
                  ev.stopPropagation();
                  runSuggestion(t);
                }}
              >
                <span className="whitespace-nowrap">{t}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="relative z-[1] mx-[18px] mb-4 mt-2 flex items-center gap-2.5 max-[859px]:mx-2.5 max-[859px]:mb-3 max-[859px]:mt-1.5 max-[859px]:gap-2"
        style={{ animation: "tInUp .55s cubic-bezier(.2,.8,.2,1) .6s both" }}
      >
        <div className="t-glass relative flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] px-[18px] py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.14),inset_0_0_0_1px_rgba(255,255,255,.07),0_18px_44px_rgba(0,0,0,.45)] max-[859px]:px-3.5">
          <span
            className="pointer-events-none absolute inset-0 rounded-[18px]"
            style={{ background: "radial-gradient(ellipse 70% 160% at 30% 100%,var(--t-hl),transparent 70%)", animation: "tBreathe 4.5s ease-in-out infinite" }}
          />
          <span
            className="pointer-events-none absolute inset-x-[18px] top-0 h-px opacity-60"
            style={{ background: "linear-gradient(90deg,transparent,var(--t-accent),transparent)", animation: "tSweep 6s ease-in-out infinite" }}
          />
          <span className="relative flex-none font-semibold" style={{ color: PROMPT_COLOR[mode] }} aria-hidden>
            {PROMPT_SYMBOL[mode]}
          </span>
          <div className="relative flex min-w-0 flex-1 items-center">
            {!input && !thinking && !fitPending && !sudoPending && ghost && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex max-w-full items-center gap-2.5 overflow-hidden whitespace-nowrap text-[13px] text-tm-dim" aria-hidden>
                <span className="truncate">{ghost}</span>
                <span className={kbd}>⏎</span>
              </span>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode === "fit" ? "paste job description…" : ""}
              aria-label={mode === "fit" ? "job description" : mode === "sudo" ? "sudo password" : "ask a question or type a command"}
              aria-autocomplete="list"
              aria-controls={open ? "t-autocomplete" : undefined}
              aria-expanded={open}
              aria-activedescendant={open ? `t-ac-${Math.min(acIdx, ac.length - 1)}` : undefined}
              role="combobox"
              type={mode === "sudo" ? "password" : "text"}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="relative min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-tm-fg"
              style={{ caretColor: "var(--t-accent)", fontSize: isMobile ? 16 : 14 }}
            />
          </div>
        </div>
        <button
          type="button"
          title="talk to me — voice mode"
          aria-label="voice mode"
          className="t-reset t-chip relative inline-flex size-[52px] flex-none items-center justify-center rounded-full text-tm-sub transition-all duration-200 hover:scale-105 hover:bg-tm-hl hover:text-tm-accent"
          onClick={(ev) => {
            ev.stopPropagation();
            onVoice();
          }}
        >
          <span className="pointer-events-none absolute inset-0 rounded-full border border-tm-accent opacity-60" style={{ animation: "tRingOut 2.4s ease-out infinite" }} />
          <MicIcon />
        </button>
        <button
          type="button"
          title="send"
          aria-label="send"
          className="t-reset inline-flex size-[52px] flex-none items-center justify-center rounded-full bg-tm-accent text-tm-bg shadow-[0_6px_18px_var(--t-hl)] transition-[transform,box-shadow] duration-200 hover:scale-105 hover:shadow-[0_8px_26px_var(--t-hl)]"
          onClick={(ev) => {
            ev.stopPropagation();
            submit(input);
          }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
});
