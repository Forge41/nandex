"use client";

import { forwardRef } from "react";

import { modeOf, PROMPT_COLOR, PROMPT_SYMBOL } from "@/lib/commands/parse";
import type { TerminalAction } from "@/lib/terminal/reducer";
import { acItems, needsArg, type AcItem } from "@/lib/terminal/suggest";
import { GreenDot } from "./entries/whoami";

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
};

const kbd = "flex-none border border-tm-border px-[5px] text-[10px] text-tm-muted";
const withArgSpace = (fill: string) => fill + (fill.includes(" ") || /theme|cat|grep/.test(fill) ? " " : "");

export const Prompt = forwardRef<HTMLInputElement, PromptProps>(function Prompt(
  { input, acIdx, fitPending, sudoPending, thinking, showLanding, ghost, suggestions, isMobile, dispatch, submit, runSuggestion, onShortcuts },
  inputRef,
) {
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
    <div className="relative flex-none border-t border-tm-border bg-tm-bg">
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
        <div className="flex flex-col px-[18px] pt-2 max-[859px]:px-3" style={{ animation: "tFade .3s" }}>
          <button
            type="button"
            className="t-reset flex items-center gap-2.5 border border-b-0 border-tm-border bg-tm-panel px-2.5 py-1.5 text-[12.5px] text-tm-green hover:bg-tm-sel"
            onClick={(ev) => {
              ev.stopPropagation();
              runSuggestion("/voice");
            }}
          >
            <GreenDot />
            <span className="min-w-0 flex-1 truncate">
              /voice <span className="text-tm-muted">— activate voice</span>
            </span>
            <span className={kbd}>⏎</span>
          </button>
          {suggestions.slice(0, isMobile ? 2 : 3).map((t) => (
            <button
              key={t}
              type="button"
              className="t-reset flex items-center gap-2.5 border border-b-0 border-tm-border bg-tm-panel px-2.5 py-1.5 text-[12.5px] text-tm-sub hover:bg-tm-sel hover:text-tm-fg"
              onClick={(ev) => {
                ev.stopPropagation();
                runSuggestion(t);
              }}
            >
              <span className="flex-none text-tm-dim">›</span>
              <span className="min-w-0 flex-1 truncate">{t}</span>
              <span className={kbd}>⏎</span>
            </button>
          ))}
          <div className="border-t border-tm-border" />
        </div>
      )}
      <div className="flex items-center gap-2.5 px-[18px] py-2.5 max-[859px]:min-h-12 max-[859px]:px-3.5 max-[859px]:py-3">
        <span className="flex-none font-semibold" style={{ color: PROMPT_COLOR[mode] }} aria-hidden>
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
            style={{ caretColor: "var(--t-accent)", fontSize: isMobile ? 16 : 13 }}
          />
        </div>
        <span className="flex-none text-[11px] text-tm-dim">{mode}</span>
      </div>
    </div>
  );
});
