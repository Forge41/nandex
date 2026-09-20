import { setRequestInterceptor } from "@/lib/api/client";
import { runOverNetwork, setRunTransport } from "@/lib/api/coding";
import type { RunHandlers, RunTransport } from "@/lib/api/coding";
import { HARNESS_SESSION_ID } from "./fixtures";

/** The harness has no server, so a call a screen makes is a fact worth seeing.
 *
 * Every attempt is recorded and shown rather than quietly answered: the second
 * question after "what does this screen look like" is "what does it depend on", and
 * this page is the only place that can answer it without reading the source.
 */
export interface AttemptedCall {
  id: number;
  method: string;
  path: string;
  answered: boolean;
}

/** How many runs the scripted runner has completed since this screen mounted.
 *
 * Passed to an answer so the attempt meter can advance. Without it a screen shows
 * nine cases passing beside "0 / 3 attempts", which is the kind of self-contradiction
 * this harness exists to catch rather than produce. */
export interface AnswerContext {
  runsCompleted: number;
}

/** What a scenario is willing to answer, keyed by path prefix -- the query string is
 * dropped first, because most of these carry one. A function is re-evaluated per
 * call, for the answers that depend on what has happened on screen; `object` rather
 * than `unknown` because a union with `unknown` is just `unknown`, and the function
 * branch would stop being type-checked. */
export type Answers = Record<string, object | ((context: AnswerContext) => unknown)>;

let attempts: AttemptedCall[] = [];
let nextId = 1;
let runsCompleted = 0;
const listeners = new Set<() => void>();

function announce(): void {
  attempts = [...attempts];
  for (const listener of listeners) listener();
}

export function subscribeAttempts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function attemptedCalls(): AttemptedCall[] {
  return attempts;
}

/** Empties the log for a fresh mount.
 *
 * Silent, and called during render rather than from an effect: effects run
 * child-first, so clearing from one would wipe the calls the stages below had
 * already made -- and announcing during render would be a setState from inside
 * another component's render. The overlay renders after this and reads the current
 * value, so there is nothing to notify. */
export function forgetAttempts(): void {
  attempts = [];
  nextId = 1;
  runsCompleted = 0;
}

function record(method: string, path: string, answered: boolean): void {
  attempts.push({ id: nextId++, method, path, answered });
  announce();
}

function answerFor(answers: Answers, path: string): { body: unknown } | null {
  const bare = path.split("?")[0];
  for (const [prefix, body] of Object.entries(answers)) {
    if (bare !== prefix && !bare.startsWith(prefix)) continue;
    return { body: typeof body === "function" ? body({ runsCompleted }) : body };
  }
  return null;
}

/** Points the two network seams at fixtures, for this session only.
 *
 * Scoped to the harness's own session id rather than cutting the network outright,
 * and never uninstalled. Both seams are module-level singletons: a client-side
 * navigation out of the harness cannot re-render this to take them down, and one left
 * pointing at fixtures would break the real app in that tab. Declining anything that
 * is not `dev-screens` makes an armed seam harmless.
 *
 * Setters only -- safe to call on every render, which is how it is called, because
 * arming from an effect would be too late: effects run child-first, so a stage's own
 * fetch goes out before a parent effect could stop it.
 */
export function armOffline(answers: Answers, run?: RunTransport): void {
  setRequestInterceptor((path, init) => {
    if (!path.includes(HARNESS_SESSION_ID)) return "pass";
    const answer = answerFor(answers, path);
    record(init.method ?? "GET", path, answer !== null);
    return answer ?? "refuse";
  });

  setRunTransport((sessionId, stage, body, handlers, signal) => {
    if (sessionId !== HARNESS_SESSION_ID) {
      return runOverNetwork(sessionId, stage, body, handlers, signal);
    }
    if (run) {
      return run(sessionId, stage, body, { ...handlers, onDone: countThenReport(handlers) }, signal);
    }

    record("POST", `/interview/sessions/${sessionId}/rounds/${stage}/runs`, false);
    handlers.onDone({
      phase: "unavailable",
      detail: "No runner here. This screen is rendered from fixtures.",
      tests: [],
      exitCode: null,
      durationMs: 0,
      truncated: false,
      timedOut: false,
    });
    return Promise.resolve();
  });
}

/** A completed run is what the attempt meter counts, so it is counted here rather
 * than in each script. */
function countThenReport(handlers: RunHandlers): RunHandlers["onDone"] {
  return (result) => {
    runsCompleted += 1;
    handlers.onDone(result);
  };
}
