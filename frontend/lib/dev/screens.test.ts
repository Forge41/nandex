import { describe, expect, it } from "vitest";
import { STAGE_COMPONENTS } from "@/components/interview/stages/registry";
import { SCREENS, findScreen, findState, sessionFor } from "./screens";
import { HARNESS_STAGES } from "./fixtures";

describe("the screen catalogue", () => {
  // The point of the harness is that nothing is unreachable. A stage added to the
  // registry with no screen here would be exactly the thing it cannot show.
  it("covers every stage that has a screen", () => {
    const covered = new Set(SCREENS.map((screen) => screen.stage).filter(Boolean));
    expect([...Object.keys(STAGE_COMPONENTS)].filter((id) => !covered.has(id as never))).toEqual(
      []
    );
  });

  it("orders its rounds the way the interview does", () => {
    expect(HARNESS_STAGES).toEqual([
      "preflight",
      "resume",
      "behavioral",
      "coding",
      "sql",
      "debug",
      "design",
      "quiz",
      "qa",
      "wrap",
    ]);
  });

  it("gives every state a session sitting at its own round", () => {
    for (const screen of SCREENS) {
      for (const state of screen.states) {
        if (state.standalone) continue;
        const session = sessionFor(screen, state);
        expect(session.activeStage).toBe(screen.stage);
        expect(session.rounds.every((round) => round.live === false)).toBe(true);
      }
    }
  });

  it("falls back to a screen's first state rather than rendering nothing", () => {
    const screen = findScreen("coding")!;
    expect(findState(screen, "no-such-state")).toBe(screen.states[0]);
    expect(findState(screen, null)).toBe(screen.states[0]);
  });
});
