"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";

import { skills } from "@/content/data";
import { estimateTokens, numberCitations, parseAnswer, plainText } from "@/lib/answer/citations";
import { answer as localAnswer } from "@/lib/answer/local";
import { pingHealth, streamPortfolio, sendMessage as postMessage } from "@/lib/api/portfolio";
import { modeOf, parseInput } from "@/lib/commands/parse";
import { runShell, runSlash, shortcutsEntry, bookEffects, type CommandContext, type Effect } from "@/lib/commands/registry";
import { analyzeFit } from "@/lib/fit/analyze";
import { readJobDescription } from "@/lib/fit/read-file";
import { loadContributions } from "@/lib/github";
import { BOOTED_KEY, COMMITS, DEFAULT_BG, LINKS, READY_STATUS, THEMES, TOUR } from "@/lib/terminal/constants";
import { L, LS, err, lines, prose } from "@/lib/terminal/lines";
import { emptyAnswer, initialState, terminalReducer, type TerminalState } from "@/lib/terminal/reducer";
import { decodeReplay, encodeReplay, exportMarkdown, shareableCommands } from "@/lib/terminal/share";
import { ghost as ghostFor, suggest } from "@/lib/terminal/suggest";
import { clockLabel, uptime } from "@/lib/terminal/time";
import type { DebugInfo, EntryBody, MessageDraft, PromptMode } from "@/lib/terminal/types";
import type { Source } from "@/lib/types";
import type { VoiceTurn } from "@/lib/voice/transcripts";
import { ApiContext, ViewContext, type TerminalApi, type TerminalView } from "./context";
import { EntryList } from "./entry-list";
import { GuiView } from "./gui-view";
import { useIsMobile, useIsNarrow } from "./hooks";
import { ChevronIcon } from "./icons";
import { InfoPane } from "./info-pane";
import { RecruiterView, ResumeModal, ShareModal } from "./overlays";
import { Prompt } from "./prompt";
import { RaceLoader } from "./race-loader";
import { SourceViewer } from "./source-viewer";
import { StatusLine } from "./status-line";
import { VoiceMode } from "./voice-mode";

export type CitationViewer = "pane" | "inline";

const SKILL_ROWS = [
  { k: "Languages & backend", items: [...skills.languages, ...skills.backend] },
  { k: "GenAI & RAG", items: [...skills.genai, ...skills.rag] },
  { k: "Agentic & voice", items: [...skills.agentic, ...skills.voice] },
  { k: "Eval, infra, tuning", items: [...skills.eval_infra, ...skills.finetune] },
];

const INFO_ROWS = [
  ["name", "Nandisha D"],
  ["role", "Generative AI Engineer"],
  ["company", "Think41 · SDE-II @ Harvey.ai"],
  ["stack", "Python · TypeScript · FastAPI · pgvector · Temporal · LiveKit"],
  ["focus", "RAG · multi-agent · MCP · voice"],
  ["location", "Bangalore, IN (UTC+5:30)"],
  ["status", "● open to interesting work"],
];

const NOT_IN_DOCS = prose([
  LS([
    ["◆ ", "accent"],
    ["That's not in my documents (resume.pdf, summary.md), so I won't guess. ", "base"],
    ["/message", "violet"],
    [" me and I'll answer personally, or try ", "muted"],
    ["/sources", "violet"],
    [".", "muted"],
  ]),
]);

function readBooted() {
  try {
    return localStorage.getItem(BOOTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    localStorage.setItem(BOOTED_KEY, "1");
  } catch {}
}

function restartFromLoader() {
  try {
    localStorage.removeItem(BOOTED_KEY);
  } catch {}
  location.assign(location.pathname + location.search);
}

function copyText(t: string): Promise<boolean> {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  };
  if (navigator.clipboard?.writeText)
    return navigator.clipboard
      .writeText(t)
      .then(() => true)
      .catch(() => fallback());
  return Promise.resolve(fallback());
}

const isTyping = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  return !!t && /INPUT|TEXTAREA/.test(t.tagName);
};

export default function Terminal({
  sources,
  bookingUrl = "",
  citationViewer = "pane",
}: {
  sources: Source[];
  bookingUrl?: string;
  citationViewer?: CitationViewer;
}) {
  const [state, dispatch] = useReducer(terminalReducer, initialState);
  const isMobile = useIsMobile();
  const narrow = useIsNarrow();
  const [loader, setLoader] = useState(() => !readBooted() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [contrib, setContrib] = useState<number[] | null>(null);

  const byId = useMemo(() => Object.fromEntries(sources.map((s) => [s.id, s])), [sources]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const latest = useRef<TerminalState>(state);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const askAbort = useRef<AbortController | null>(null);
  const hashHandled = useRef(false);

  useLayoutEffect(() => {
    latest.current = state;
  });

  const after = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const focus = () => inputRef.current?.focus({ preventScroll: true });
  const push = (entry: EntryBody) => {
    const id = nextId.current++;
    dispatch({ type: "PUSH", id, entry });
    return id;
  };
  const echo = (text: string, mode: PromptMode | "voice") => push({ kind: "cmd", mode, text });

  function start() {
    dispatch({ type: "STATUS", msg: READY_STATUS });
    echo("!whoami", "shell");
    push({ kind: "whoami" });
    push(prose([LS([["Ask me anything, or type ", "muted"], ["/", "violet"], [" for commands, ", "muted"], ["!", "accent"], [" for shell.", "muted"]])]));
    after(80, focus);
    if (hashHandled.current) return;
    hashHandled.current = true;
    const hash = location.hash;
    const src = hash.match(/src=([\w-]+)/);
    if (src && byId[src[1]]) after(400, () => openSource(src[1]));
    const replay = decodeReplay(hash);
    if (replay) {
      after(900, () => {
        push(prose([L(`replaying a shared conversation · ${replay.length} turns`, "muted")]));
        replay.forEach((c, i) => after(600 + i * 1500, () => submit(c, true)));
      });
    }
    if (/recruiter/.test(hash)) after(300, () => dispatch({ type: "PANEL", panel: "recruiter", open: true }));
  }

  function clear() {
    clearTimers();
    askAbort.current?.abort();
    dispatch({ type: "CLEAR" });
    after(60, start);
  }

  function openPane(id: string) {
    dispatch({ type: "OPEN_VIEWER", id });
  }

  function openSource(id: string, entryId?: number) {
    if (!byId[id]) return;
    history.replaceState(null, "", "#src=" + id);
    const entry = entryId ? latest.current.entries.find((e) => e.id === entryId) : undefined;
    if (citationViewer === "inline" && entry?.kind === "ai") {
      dispatch({ type: "INLINE_SOURCE", id: entry.id, sourceId: id });
      return;
    }
    openPane(id);
  }

  function closeViewer() {
    dispatch({ type: "CLOSE_VIEWER" });
    history.replaceState(null, "", location.pathname + location.search);
    focus();
  }

  const copyLink = (id: string) => copyText(`${location.origin}${location.pathname}#src=${id}`);

  function interrupt() {
    askAbort.current?.abort();
    askAbort.current = null;
    clearTimers();
    const s = latest.current;
    dispatch({ type: "THINKING", on: false });
    if (s.streamingId != null) dispatch({ type: "STREAM_END", id: s.streamingId, target: "answer" });
    push(prose([L("^C interrupted", "muted")]));
  }

  /** Streams from the agent; any failure before `done` answers from the local matcher instead. */
  function ask(q: string): Promise<string | null> {
    askAbort.current?.abort();
    const controller = new AbortController();
    askAbort.current = controller;
    const t0 = performance.now();
    const minThink = 900 + Math.random() * 700;
    const showDebug = latest.current.verbose;
    let entryId: number | null = null;
    let retrieved: string[] = [];
    let raw = "";
    let done: { latencyMs: number; outputTokens: number } | null = null;

    dispatch({ type: "THINKING", on: true });

    return new Promise((resolve) => {
      const offline = () =>
        after(Math.max(0, t0 + minThink - performance.now()), () => {
          if (controller.signal.aborted) return resolve(null);
          dispatch({ type: "CONNECTION", state: "offline" });
          dispatch({ type: "THINKING", on: false });
          const res = localAnswer(q, sources);
          const debug: DebugInfo | null = res
            ? {
                retrieved: numberCitations(res.paras).order,
                latencyMs: Math.round(performance.now() - t0),
                tokens: estimateTokens(res.paras),
                estimated: true,
                offline: true,
              }
            : null;
          if (entryId != null) {
            if (res) dispatch({ type: "STREAM_REPLACE", id: entryId, answer: { paras: res.paras, raw: "", valid: [], streaming: false }, debug });
            else dispatch({ type: "STREAM_END", id: entryId, target: "answer" });
            return resolve(res ? plainText(res.paras) : plainText(parseAnswer(raw, retrieved)));
          }
          if (!res) {
            push(NOT_IN_DOCS);
            return resolve(null);
          }
          push({ kind: "ai", answer: { paras: res.paras, raw: "", valid: [], streaming: false }, debug, showDebug, inlineId: null });
          resolve(plainText(res.paras));
        });

      streamPortfolio("ask", { question: q }, {
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === "retrieved") {
            retrieved = ev.sources.map((s) => s.id);
            if (entryId != null) dispatch({ type: "STREAM_RETRIEVED", id: entryId, target: "answer", valid: retrieved });
          } else if (ev.type === "delta") {
            if (entryId == null) {
              dispatch({ type: "THINKING", on: false });
              entryId = push({ kind: "ai", answer: emptyAnswer(retrieved), debug: null, showDebug, inlineId: null });
              dispatch({ type: "STREAMING", id: entryId });
            }
            raw += ev.text;
            dispatch({ type: "STREAM_DELTA", id: entryId, target: "answer", delta: ev.text });
          } else if (ev.type === "done") done = { latencyMs: ev.latencyMs, outputTokens: ev.outputTokens };
        },
      })
        .then(() => {
          if (entryId == null || !raw.trim()) return offline();
          dispatch({ type: "CONNECTION", state: "live" });
          dispatch({
            type: "STREAM_END",
            id: entryId,
            target: "answer",
            debug: {
              retrieved,
              latencyMs: done?.latencyMs ?? Math.round(performance.now() - t0),
              tokens: done?.outputTokens ?? 0,
              estimated: false,
              offline: false,
            },
          });
          resolve(plainText(parseAnswer(raw, retrieved)));
        })
        .catch(() => {
          if (controller.signal.aborted) return resolve(null);
          offline();
        })
        .finally(() => {
          if (askAbort.current === controller) askAbort.current = null;
        });
    });
  }

  function runFit(jd: string) {
    const res = analyzeFit(jd);
    if (!res) {
      push(prose([L("fit: I couldn't find recognisable skills in that text. Paste the requirements section of a JD.", "muted")]));
      return;
    }
    const id = push({ kind: "fit", card: res.card, noteOpen: false, noteText: res.noteText, assessment: emptyAnswer() });
    dispatch({ type: "STATUS", msg: READY_STATUS });
    streamPortfolio("fit", { jd }, {
      onEvent: (ev) => {
        if (ev.type === "retrieved")
          dispatch({ type: "STREAM_RETRIEVED", id, target: "assessment", valid: ev.sources.map((s) => s.id) });
        if (ev.type === "delta") dispatch({ type: "STREAM_DELTA", id, target: "assessment", delta: ev.text });
      },
    })
      .then(() => {
        dispatch({ type: "CONNECTION", state: "live" });
        dispatch({ type: "STREAM_END", id, target: "assessment" });
      })
      .catch(() => {
        dispatch({ type: "CONNECTION", state: "offline" });
        dispatch({ type: "ASSESSMENT_DROP", id });
      });
  }

  function fitTypeMode() {
    dispatch({ type: "FIT_PENDING", on: true, status: "waiting for text in the prompt below…" });
    after(50, focus);
  }

  async function fitFile(file: File) {
    dispatch({ type: "FIT_STATUS", status: `reading ${file.name}…` });
    try {
      const text = await readJobDescription(file);
      dispatch({ type: "FIT_STATUS", status: `parsed ${file.name} · ${text.split(" ").length} words` });
      echo(`${file.name} (${Math.round(file.size / 1024)} KB)`, "fit");
      runFit(text);
    } catch {
      dispatch({ type: "FIT_STATUS", status: `could not read ${file.name} — try pasting the text instead.` });
    }
  }

  async function sendMessage(draft: MessageDraft) {
    if (!draft.email || !draft.text) {
      push(err("message: email and text are required"));
      return;
    }
    dispatch({ type: "REMOVE_FORMS" });
    const res = await postMessage(draft);
    if (res.ok) {
      push(prose([LS([["✓ ", "green"], [`message from ${draft.name || "anonymous"} <${draft.email}> delivered. I'll reply within a day.`, "base"]])]));
      return;
    }
    if (res.status === 400) {
      push(err(`message: ${res.detail}`));
      push({ kind: "form", initial: draft });
      return;
    }
    push(prose([L(`${res.status === 429 ? res.detail : "endpoint unreachable"} — opening your mail client instead.`, "muted")]));
    const body = encodeURIComponent(`${draft.text}\n\n— ${draft.name || "anonymous"} <${draft.email}>`);
    window.open(`mailto:${LINKS.email}?subject=${encodeURIComponent("From your terminal portfolio")}&body=${body}`, "_blank");
    push(prose([LS([["✓ ", "green"], ["mail draft opened with your message. Send it and I'll reply within a day.", "base"]])]));
  }

  function randomCommit(kind: "pr" | "skill") {
    const s = latest.current;
    const hash = Array.from({ length: 7 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    const msg = COMMITS[Math.floor(Math.random() * COMMITS.length)];
    const files = 1 + Math.floor(Math.random() * 6);
    const ins = 8 + Math.floor(Math.random() * 180);
    const del = Math.floor(Math.random() * 60);
    dispatch({ type: "COMMIT", kind });
    push(
      lines([
        LS([[`[main ${hash}] `, "accent"], [msg, "base"]]),
        LS([[` ${files} file${files > 1 ? "s" : ""} changed, `, "muted"], [`${ins} insertions(+)`, "green"], [", ", "muted"], [`${del} deletions(-)`, "red"]]),
        LS([[kind === "pr" ? ` → merged PR #${s.prCount + 1}` : ` → skill #${s.skillCount + 1} registered`, "dim"]]),
      ]),
    );
  }

  function openVoice() {
    if (latest.current.voice) return;
    dispatch({ type: "VOICE", on: true });
  }

  function exitVoice() {
    dispatch({ type: "VOICE", on: false });
    after(50, focus);
  }

  function voiceEnded(note: string) {
    dispatch({ type: "VOICE", on: false });
    after(0, () => push(prose([L(note, "muted")])));
    after(50, focus);
  }

  function voiceTranscript(turns: VoiceTurn[]) {
    for (const t of turns) {
      if (t.who === "you") push({ kind: "voiceTurn", text: t.text });
      else push(prose([LS([["◆ ", "accent"], [t.text, "base"]])]));
    }
  }

  function share() {
    const cmds = shareableCommands(latest.current.entries);
    if (!cmds.length) {
      push(prose([L("nothing to share yet — ask something first.", "muted")]));
      return;
    }
    const url = `${location.origin}${location.pathname}#c=${encodeReplay(cmds)}`;
    void copyText(url).then((ok) =>
      push(
        prose([
          LS([
            [ok ? "✓ " : "· ", ok ? "green" : "muted"],
            [`${ok ? "link copied — it" : "copy blocked — this link"} replays these ${cmds.length} turns for whoever opens it:`, "base"],
          ]),
          L(url, "dim"),
        ]),
      ),
    );
  }

  function exportConversation() {
    const whoami = INFO_ROWS.map(([k, v]) => `- ${k}: ${v}`)
      .concat(`- uptime: ${uptime(Date.now())}`)
      .join("\n");
    const md = exportMarkdown(latest.current.entries, byId, whoami);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "nandisha-conversation.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    push(prose([L("exported nandisha-conversation.md", "muted")]));
  }

  function exec(effects: Effect[]) {
    for (const fx of effects) {
      switch (fx.type) {
        case "push":
          push(fx.entry);
          break;
        case "later":
          after(fx.ms, () => push(fx.entry));
          break;
        case "clear":
          clear();
          break;
        case "openUrl":
          window.open(fx.url, "_blank");
          break;
        case "reload":
          restartFromLoader();
          break;
        case "sudo":
          dispatch({ type: "SUDO_START", id: nextId.current++ });
          after(50, focus);
          break;
        case "voice":
          if (latest.current.voice) exitVoice();
          else openVoice();
          break;
        case "tour":
          push(prose([L(`tour: running ${TOUR.length} commands · esc to stop`, "muted")]));
          TOUR.forEach((c, i) => after(600 + i * 1400, () => submit(c, true)));
          break;
        case "fitPrompt":
          dispatch({ type: "FIT_PROMPT", id: push({ kind: "fitPrompt", status: "instant local match, then a cited assessment from the agent." }) });
          break;
        case "fit":
          runFit(fx.jd);
          break;
        case "theme":
          dispatch({ type: "THEME", name: fx.name });
          break;
        case "verbose":
          dispatch({ type: "VERBOSE", on: fx.on });
          break;
        case "gui":
          dispatch({ type: "PANEL", panel: "gui", open: true });
          break;
        case "export":
          exportConversation();
          break;
        case "share":
          share();
          break;
        case "recruiter":
          dispatch({ type: "PANEL", panel: "recruiter", open: true });
          break;
      }
    }
  }

  function commandContext(s: TerminalState): CommandContext {
    const now = Date.now();
    return { sources, byId, theme: s.theme, verbose: s.verbose, now, clock: clockLabel(now), bookingUrl };
  }

  function submit(raw: string, silent = false) {
    const s = latest.current;
    const text = raw.trim() || ghostFor(suggestState(s));
    if (!text) return;
    dispatch({ type: "SUBMITTED", text, silent: silent || s.sudoPending });

    const parsed = parseInput(text, s);
    switch (parsed.kind) {
      case "sudo":
        dispatch({ type: "SUDO_DONE" });
        after(500, () => {
          push(prose([L("visitor is not in the sudoers file. This incident will be reported… to Nandisha, who considers it a compliment.", "accent")]));
          after(400, () => exec(bookEffects(bookingUrl)));
        });
        return;
      case "fit":
        echo(text.length > 120 ? text.slice(0, 120) + "…" : text, "fit");
        dispatch({ type: "FIT_PENDING", on: false });
        runFit(text);
        return;
      case "shell":
        echo(text, "shell");
        exec(runShell(parsed.cmd, commandContext(s)));
        return;
      case "slash":
        echo(text, "slash");
        exec(runSlash(parsed.name, parsed.arg, commandContext(s)));
        return;
      case "chat":
        echo(text, "chat");
        void ask(text);
    }
  }

  function runSuggestion(text: string) {
    dispatch({ type: "INPUT", value: text });
    after(220, () => submit(text));
  }

  function loaderDone() {
    markBooted();
    setLoader(false);
    after(50, start);
  }

  const impl = useRef({ submit, focus, openSource, openPane, fitTypeMode, fitFile, sendMessage, randomCommit, openVoice, loaderDone });
  useLayoutEffect(() => {
    impl.current = { submit, focus, openSource, openPane, fitTypeMode, fitFile, sendMessage, randomCommit, openVoice, loaderDone };
  });

  const api = useMemo<TerminalApi>(
    () => ({
      sources,
      byId,
      dispatch,
      copyText,
      copyLink: (id) => copyText(`${location.origin}${location.pathname}#src=${id}`),
      submit: (t, s) => impl.current.submit(t, s),
      focus: () => impl.current.focus(),
      openSource: (id, e) => impl.current.openSource(id, e),
      openPane: (id) => impl.current.openPane(id),
      fitTypeMode: () => impl.current.fitTypeMode(),
      fitFile: (f) => void impl.current.fitFile(f),
      sendMessage: (d) => void impl.current.sendMessage(d),
      randomCommit: (k) => impl.current.randomCommit(k),
      openVoice: () => impl.current.openVoice(),
      openShare: () => dispatch({ type: "PANEL", panel: "shareOpen", open: true }),
      openResume: () => dispatch({ type: "PANEL", panel: "resumeOpen", open: true }),
    }),
    [sources, byId],
  );

  const view = useMemo<TerminalView>(
    () => ({ theme: state.theme, isMobile, prCount: state.prCount, skillCount: state.skillCount, contrib }),
    [state.theme, isMobile, state.prCount, state.skillCount, contrib],
  );

  const onGlobalKey = useEffectEvent((ev: KeyboardEvent) => {
    const s = latest.current;
    if (loader || ev.defaultPrevented) return;
    const esc = ev.key === "Escape";
    if (s.shareOpen) {
      if (esc) closePanel("shareOpen");
      return;
    }
    if (s.recruiter) {
      if (esc) closePanel("recruiter");
      return;
    }
    if (s.resumeOpen) {
      if (esc) closePanel("resumeOpen");
      return;
    }
    if (s.gui) {
      if (esc) closePanel("gui");
      return;
    }
    if (s.voice && esc && !(isTyping(ev) && (ev.target as HTMLInputElement).value)) {
      exitVoice();
      return;
    }
    if (ev.key === "l" && ev.ctrlKey) {
      ev.preventDefault();
      clear();
    }
    if (esc) {
      if (s.thinking || s.streamingId != null) interrupt();
      else if (s.fitPending) dispatch({ type: "FIT_PENDING", on: false, status: "cancelled." });
      else if (s.viewerId) closeViewer();
    }
    if (ev.key === "q" && s.viewerId && !isTyping(ev)) closeViewer();
    if (ev.key === "?" && !(isTyping(ev) && (ev.target as HTMLInputElement).value)) {
      ev.preventDefault();
      push(shortcutsEntry());
    }
  });

  const onMount = useEffectEvent(() => {
    if (!loader) after(50, start);
    void pingHealth().then((ok) => {
      if (ok) dispatch({ type: "CONNECTION", state: "live" });
      else if (latest.current.connection === "checking") dispatch({ type: "CONNECTION", state: "offline" });
    });
    void loadContributions().then((grid) => grid && setContrib(grid));
  });

  useEffect(() => {
    onMount();
    const tick = setInterval(() => dispatch({ type: "TICK" }), 1000);
    const onKey = (ev: KeyboardEvent) => onGlobalKey(ev);
    window.addEventListener("keydown", onKey);
    const pending = timers.current;
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", onKey);
      pending.forEach(clearTimeout);
      askAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    document.body.style.background = THEMES[state.theme]?.["--t-bg"] ?? DEFAULT_BG;
  }, [state.theme]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    const ro = new ResizeObserver(toBottom);
    ro.observe(content);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loader]);

  const onLoaderDone = useMemo(() => () => impl.current.loaderDone(), []);

  function closePanel(panel: "shareOpen" | "recruiter" | "resumeOpen" | "gui") {
    dispatch({ type: "PANEL", panel, open: false });
    after(50, focus);
  }

  const s = state;
  const mode = modeOf(s.input, s);
  const suggestions = suggest(suggestState(s));
  const squeezed = (s.viewerId != null || s.voice) && narrow;
  const showInfoPane = isMobile ? s.infoSheet : !s.infoCollapsed && !squeezed;
  const infoHidden = !isMobile && (s.infoCollapsed || squeezed);
  const themeVars = (THEMES[s.theme] ?? {}) as React.CSSProperties;

  return (
    <ApiContext.Provider value={api}>
      <ViewContext.Provider value={view}>
        <div
          className="terminal-root dark fixed inset-0 flex flex-col bg-tm-bg font-mono text-tm-fg"
          style={{ ...themeVars, fontSize: isMobile ? 12.5 : 13, lineHeight: 1.6 }}
        >
          {loader && <RaceLoader isMobile={isMobile} onDone={onLoaderDone} />}

          <div className="relative flex min-h-0 flex-1">
            <section
              data-screen-label="Terminal"
              aria-label="terminal"
              className="relative flex min-w-0 flex-1 flex-col bg-tm-bg"
              onClick={() => {
                if (!window.getSelection()?.toString()) focus();
              }}
            >
              <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
                <span className="text-tm-accent">1</span>
                <span className="truncate">nandisha@portfolio: ~</span>
                <span className="flex-1" />
                {isMobile && (
                  <button
                    type="button"
                    className="t-reset inline-flex h-[30px] items-center gap-1.5 px-1 text-[11px] uppercase tracking-[.08em] text-tm-sub"
                    aria-expanded={s.infoSheet}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      dispatch({ type: "SHEET", open: !s.infoSheet });
                    }}
                  >
                    {s.infoSheet ? "close" : "≡ info"}
                  </button>
                )}
              </div>

              <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label="terminal output"
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                style={{ padding: isMobile ? "12px 12px 8px" : "14px 18px 8px" }}
              >
                <div ref={contentRef}>
                  <EntryList entries={s.entries} thinking={s.thinking} />
                </div>
              </div>

              <Prompt
                ref={inputRef}
                input={s.input}
                acIdx={s.acIdx}
                fitPending={s.fitPending}
                sudoPending={s.sudoPending}
                thinking={s.thinking}
                showLanding={s.landing && !s.thinking && !s.input && !s.voice && !loader}
                ghost={s.thinking ? "" : ghostFor(suggestState(s))}
                suggestions={suggestions}
                isMobile={isMobile}
                dispatch={dispatch}
                submit={submit}
                runSuggestion={runSuggestion}
                onShortcuts={() => push(shortcutsEntry())}
              />
            </section>

            {s.voice && (
              <VoiceMode
                theme={s.theme}
                thinking={s.thinking}
                verbose={s.verbose}
                onExit={exitVoice}
                onEnded={voiceEnded}
                onStatus={(msg) => dispatch({ type: "STATUS", msg })}
                onTranscript={voiceTranscript}
              />
            )}

            {s.viewerId && <SourceViewer sources={sources} viewerId={s.viewerId} isMobile={isMobile} onClose={closeViewer} onCopy={copyLink} />}

            {!isMobile && !s.voice && !s.gui && !s.recruiter && (
              <button
                type="button"
                title={infoHidden ? "show info pane" : "hide info pane"}
                aria-label={infoHidden ? "show info pane" : "hide info pane"}
                className="t-reset absolute top-1/2 z-[15] flex h-16 w-[30px] items-center justify-center rounded-md border border-tm-border bg-tm-panel text-tm-muted shadow-[0_4px_16px_rgba(0,0,0,.4)] hover:border-tm-accent hover:bg-tm-hl hover:text-tm-accent"
                style={{
                  right: showInfoPane ? 312 : 0,
                  transform: "translate(50%, -50%)",
                  transition: "right .3s cubic-bezier(.2,.8,.2,1), background .2s, color .2s, border-color .2s",
                }}
                onClick={() => dispatch({ type: "TOGGLE_INFO" })}
              >
                <ChevronIcon style={{ transform: s.infoCollapsed ? "rotate(180deg)" : "none", transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }} />
              </button>
            )}

            {showInfoPane && (
              <InfoPane
                isMobile={isMobile}
                onClose={() => dispatch({ type: "SHEET", open: false })}
                onRun={(cmd) => submit(cmd)}
                onOpenResume={() => dispatch({ type: "PANEL", panel: "resumeOpen", open: true })}
              />
            )}
          </div>

          <StatusLine
            mode={mode}
            theme={s.theme}
            statusMsg={s.statusMsg}
            isMobile={isMobile}
            viewerOpen={s.viewerId != null}
            verbose={s.verbose}
            connection={s.connection}
          />

          {s.recruiter && (
            <RecruiterView
              theme={s.theme}
              onExit={() => closePanel("recruiter")}
              onBook={() => {
                dispatch({ type: "PANEL", panel: "recruiter", open: false });
                after(80, () => submit("/book"));
              }}
            />
          )}
          {s.shareOpen && <ShareModal url={`${location.origin}${location.pathname}`} copyText={copyText} onClose={() => closePanel("shareOpen")} />}
          {s.resumeOpen && <ResumeModal onClose={() => closePanel("resumeOpen")} />}
          {s.gui && <GuiView byId={byId} skills={SKILL_ROWS} onExit={() => closePanel("gui")} />}
        </div>
      </ViewContext.Provider>
    </ApiContext.Provider>
  );
}

function suggestState(s: TerminalState) {
  return {
    history: s.history,
    commands: s.entries.flatMap((e) => (e.kind === "cmd" ? [e.text] : [])),
    sugSeed: s.sugSeed,
    landing: s.landing,
    fitPending: s.fitPending,
    sudoPending: s.sudoPending,
  };
}
