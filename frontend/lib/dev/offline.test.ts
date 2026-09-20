import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, setRequestInterceptor } from "@/lib/api/client";
import { armOffline, attemptedCalls, forgetAttempts } from "./offline";
import { HARNESS_SESSION_ID } from "./fixtures";

const HARNESS_PATH = `/interview/sessions/${HARNESS_SESSION_ID}/rounds/coding/runs`;

describe("the harness's network seam", () => {
  beforeEach(() => {
    setRequestInterceptor(null);
    forgetAttempts();
  });

  it("answers a path it has a fixture for", async () => {
    armOffline({ [HARNESS_PATH]: { attemptsUsed: 2 } });

    await expect(apiFetch(`${HARNESS_PATH}?taskIndex=0`)).resolves.toEqual({
      attemptsUsed: 2,
    });
  });

  it("refuses a harness path it has no fixture for, and says which", async () => {
    armOffline({});

    await expect(apiFetch(HARNESS_PATH)).rejects.toThrow(HARNESS_PATH);
    expect(attemptedCalls()).toEqual([
      { id: 1, method: "GET", path: HARNESS_PATH, answered: false },
    ]);
  });

  // The property the design rests on: the seam is never uninstalled, because a
  // client-side navigation out of the harness cannot re-render it to take one down.
  // Leaving it armed is only safe while it declines every other session.
  it("lets another session's call through to the network", async () => {
    armOffline({ [HARNESS_PATH]: {} });

    const sent: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      sent.push(url);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await apiFetch("/interview/sessions/a-real-one");

    expect(sent).toEqual(["/api/interview/sessions/a-real-one"]);
    expect(attemptedCalls()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("re-evaluates an answer that depends on runs completed", async () => {
    armOffline({ [HARNESS_PATH]: ({ runsCompleted }) => ({ runsCompleted }) });

    await expect(apiFetch(HARNESS_PATH)).resolves.toEqual({ runsCompleted: 0 });
  });
});
