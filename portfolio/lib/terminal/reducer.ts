import { parseAnswer } from "@/lib/answer/citations";
import { READY_STATUS } from "./constants";
import type { AnswerBody, DebugInfo, Entry, EntryBody, ThemeName } from "./types";

export type Connection = "checking" | "live" | "offline";
export type Panel = "gui" | "recruiter" | "shareOpen" | "resumeOpen";
export type StreamTarget = "answer" | "assessment";

export type TerminalState = {
  entries: Entry[];
  input: string;
  history: string[];
  histIdx: number;
  acIdx: number;
  thinking: boolean;
  streamingId: number | null;
  landing: boolean;
  sugSeed: number;
  fitPending: boolean;
  fitPromptId: number | null;
  sudoPending: boolean;
  theme: ThemeName;
  verbose: boolean;
  viewerId: string | null;
  gui: boolean;
  recruiter: boolean;
  shareOpen: boolean;
  resumeOpen: boolean;
  voice: boolean;
  infoCollapsed: boolean;
  infoCollapsedBeforeVoice: boolean;
  infoSheet: boolean;
  statusMsg: string;
  connection: Connection;
  prCount: number;
  skillCount: number;
  tick: number;
};

export const initialState: TerminalState = {
  entries: [],
  input: "",
  history: [],
  histIdx: -1,
  acIdx: 0,
  thinking: false,
  streamingId: null,
  landing: true,
  sugSeed: 0,
  fitPending: false,
  fitPromptId: null,
  sudoPending: false,
  theme: "default",
  verbose: false,
  viewerId: null,
  gui: false,
  recruiter: false,
  shareOpen: false,
  resumeOpen: false,
  voice: false,
  infoCollapsed: false,
  infoCollapsedBeforeVoice: false,
  infoSheet: false,
  statusMsg: READY_STATUS,
  connection: "checking",
  prCount: 1080,
  skillCount: 600,
  tick: 0,
};

export type TerminalAction =
  | { type: "PUSH"; id: number; entry: EntryBody }
  | { type: "REMOVE_FORMS" }
  | { type: "CLEAR" }
  | { type: "INPUT"; value: string }
  | { type: "SUBMITTED"; text: string; silent: boolean }
  | { type: "HISTORY"; dir: 1 | -1 }
  | { type: "AC_MOVE"; delta: 1 | -1; count: number }
  | { type: "THINKING"; on: boolean }
  | { type: "STREAMING"; id: number | null }
  | { type: "FIT_PROMPT"; id: number }
  | { type: "FIT_PENDING"; on: boolean; status?: string }
  | { type: "FIT_STATUS"; status: string }
  | { type: "SUDO_START"; id: number }
  | { type: "SUDO_DONE" }
  | { type: "NOTE_TOGGLE"; id: number }
  | { type: "NOTE_EDIT"; id: number; text: string }
  | { type: "INLINE_SOURCE"; id: number; sourceId: string | null }
  | { type: "STREAM_RETRIEVED"; id: number; target: StreamTarget; valid: string[] }
  | { type: "STREAM_DELTA"; id: number; target: StreamTarget; delta: string }
  | { type: "STREAM_END"; id: number; target: StreamTarget; debug?: DebugInfo }
  | { type: "STREAM_REPLACE"; id: number; answer: AnswerBody; debug: DebugInfo | null }
  | { type: "ASSESSMENT_DROP"; id: number }
  | { type: "THEME"; name: ThemeName }
  | { type: "VERBOSE"; on: boolean }
  | { type: "OPEN_VIEWER"; id: string }
  | { type: "CLOSE_VIEWER" }
  | { type: "PANEL"; panel: Panel; open: boolean }
  | { type: "VOICE"; on: boolean }
  | { type: "TOGGLE_INFO" }
  | { type: "SHEET"; open: boolean }
  | { type: "STATUS"; msg: string }
  | { type: "CONNECTION"; state: Connection }
  | { type: "TICK" }
  | { type: "COMMIT"; kind: "pr" | "skill" };

export const emptyAnswer = (valid: string[] = []): AnswerBody => ({ paras: [], raw: "", valid, streaming: true });

function mapEntry(state: TerminalState, id: number | null, fn: (e: Entry) => Entry): TerminalState {
  if (id == null) return state;
  return { ...state, entries: state.entries.map((e) => (e.id === id ? fn(e) : e)) };
}

function mapStream(state: TerminalState, id: number, target: StreamTarget, fn: (a: AnswerBody) => AnswerBody) {
  return mapEntry(state, id, (e) => {
    if (target === "answer" && e.kind === "ai") return { ...e, answer: fn(e.answer) };
    if (target === "assessment" && e.kind === "fit" && e.assessment) return { ...e, assessment: fn(e.assessment) };
    return e;
  });
}

export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case "PUSH":
      return { ...state, entries: [...state.entries, { ...action.entry, id: action.id } as Entry] };

    case "REMOVE_FORMS":
      return { ...state, entries: state.entries.filter((e) => e.kind !== "form") };

    case "CLEAR":
      return { ...state, entries: [], viewerId: null, landing: true, input: "", thinking: false, streamingId: null };

    case "INPUT":
      return { ...state, input: action.value, acIdx: 0 };

    case "SUBMITTED":
      return {
        ...state,
        input: "",
        acIdx: 0,
        histIdx: -1,
        landing: false,
        infoSheet: false,
        sugSeed: state.sugSeed + 1,
        history: action.silent ? state.history : [...state.history.filter((h) => h !== action.text), action.text].slice(-50),
      };

    case "HISTORY": {
      const h = state.history;
      if (!h.length) return state;
      const from = state.histIdx < 0 ? h.length : state.histIdx;
      const i = Math.max(0, Math.min(h.length, from + action.dir));
      return { ...state, histIdx: i >= h.length ? -1 : i, input: i >= h.length ? "" : h[i] };
    }

    case "AC_MOVE":
      if (action.count <= 0) return state;
      return { ...state, acIdx: (state.acIdx + action.delta + action.count) % action.count };

    case "THINKING":
      return { ...state, thinking: action.on };

    case "STREAMING":
      return { ...state, streamingId: action.id };

    case "FIT_PROMPT":
      return { ...state, fitPromptId: action.id };

    case "FIT_PENDING": {
      const next = { ...state, fitPending: action.on, statusMsg: action.on ? "paste the job description and press enter · esc to cancel" : READY_STATUS };
      return action.status === undefined ? next : terminalReducer(next, { type: "FIT_STATUS", status: action.status });
    }

    case "FIT_STATUS":
      return mapEntry(state, state.fitPromptId, (e) => (e.kind === "fitPrompt" ? { ...e, status: action.status } : e));

    case "SUDO_START":
      return { ...state, sudoPending: true, entries: [...state.entries, { id: action.id, kind: "sudo", mask: "" }] };

    case "SUDO_DONE":
      return {
        ...state,
        sudoPending: false,
        entries: state.entries.map((e) => (e.kind === "sudo" ? { ...e, mask: "••••••••" } : e)),
      };

    case "NOTE_TOGGLE":
      return mapEntry(state, action.id, (e) => (e.kind === "fit" ? { ...e, noteOpen: !e.noteOpen } : e));

    case "NOTE_EDIT":
      return mapEntry(state, action.id, (e) => (e.kind === "fit" ? { ...e, noteText: action.text } : e));

    case "INLINE_SOURCE":
      return mapEntry(state, action.id, (e) => (e.kind === "ai" ? { ...e, inlineId: action.sourceId } : e));

    case "STREAM_RETRIEVED":
      return mapStream(state, action.id, action.target, (a) => ({ ...a, valid: action.valid, paras: parseAnswer(a.raw, action.valid, true) }));

    case "STREAM_DELTA":
      return mapStream(state, action.id, action.target, (a) => {
        const raw = a.raw + action.delta;
        return { ...a, raw, paras: parseAnswer(raw, a.valid, true) };
      });

    case "STREAM_END": {
      const ended = mapStream(state, action.id, action.target, (a) => ({ ...a, streaming: false, paras: parseAnswer(a.raw, a.valid) }));
      const withDebug = action.debug
        ? mapEntry(ended, action.id, (e) => (e.kind === "ai" ? { ...e, debug: action.debug ?? null } : e))
        : ended;
      return state.streamingId === action.id ? { ...withDebug, streamingId: null } : withDebug;
    }

    case "STREAM_REPLACE": {
      const next = mapEntry(state, action.id, (e) => (e.kind === "ai" ? { ...e, answer: action.answer, debug: action.debug } : e));
      return state.streamingId === action.id ? { ...next, streamingId: null } : next;
    }

    case "ASSESSMENT_DROP":
      return mapEntry(state, action.id, (e) => (e.kind === "fit" ? { ...e, assessment: null } : e));

    case "THEME":
      return { ...state, theme: action.name };

    case "VERBOSE":
      return { ...state, verbose: action.on };

    case "OPEN_VIEWER":
      return { ...state, viewerId: action.id };

    case "CLOSE_VIEWER":
      return { ...state, viewerId: null };

    case "PANEL":
      return { ...state, [action.panel]: action.open, ...(action.panel === "recruiter" && action.open ? { landing: false } : {}) };

    case "VOICE":
      if (action.on === state.voice) return state;
      return action.on
        ? { ...state, voice: true, infoCollapsedBeforeVoice: state.infoCollapsed, infoCollapsed: true, viewerId: null, statusMsg: "voice: just talk · esc to end" }
        : { ...state, voice: false, infoCollapsed: state.infoCollapsedBeforeVoice, statusMsg: READY_STATUS };

    case "TOGGLE_INFO":
      return { ...state, infoCollapsed: !state.infoCollapsed };

    case "SHEET":
      return { ...state, infoSheet: action.open };

    case "STATUS":
      return { ...state, statusMsg: action.msg };

    case "CONNECTION":
      return { ...state, connection: action.state };

    case "TICK": {
      const tick = state.tick + 1;
      return {
        ...state,
        tick,
        prCount: state.prCount + (tick % 9 === 0 ? 1 : 0),
        skillCount: state.skillCount + (tick % 14 === 0 ? 1 : 0),
        sugSeed: tick % 7 === 0 ? state.sugSeed + 1 : state.sugSeed,
      };
    }

    case "COMMIT":
      return action.kind === "pr" ? { ...state, prCount: state.prCount + 1 } : { ...state, skillCount: state.skillCount + 1 };
  }
}
