import { describe, expect, it } from "vitest";

import { requestVoiceToken } from "@/lib/api/portfolio";
import { engineLabel, MIC_DENIED, planFromConnectError, planFromToken } from "./plan";

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("voice mode decision", () => {
  it("uses LiveKit on 201", async () => {
    const res = await requestVoiceToken(
      respond(201, { token: "t", ws_url: "wss://lk", room_name: "r", identity: "visitor-1", expires_in: 600, max_minutes: 5 }),
    );
    const plan = planFromToken(res);
    expect(plan).toEqual({
      engine: "livekit",
      token: { token: "t", wsUrl: "wss://lk", roomName: "r", identity: "visitor-1", expiresIn: 600, maxMinutes: 5 },
    });
    expect(engineLabel(plan)).toBe("engine: livekit agent · r");
  });

  it("offers no stand-in voice on 503, 429 or network errors, and says why", async () => {
    expect(planFromToken(await requestVoiceToken(respond(503, { detail: "voice is disabled", fallback: true })))).toEqual({
      engine: "text",
      reason: "voice unavailable: voice is disabled — keep typing.",
    });
    expect(planFromToken(await requestVoiceToken(respond(429, { detail: "Too many.", fallback: true })))).toEqual({
      engine: "text",
      reason: "voice unavailable: Too many — keep typing.",
    });
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const plan = planFromToken(await requestVoiceToken(offline));
    expect(plan).toEqual({ engine: "text", reason: "voice unavailable: voice service unreachable — keep typing." });
    expect(engineLabel(plan)).toBe("engine: none (voice unavailable: voice service unreachable — keep typing.)");
  });

  it("returns to typing when the mic is denied or the agent can't be reached", () => {
    const denied = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    expect(planFromConnectError(denied)).toEqual({ engine: "text", reason: MIC_DENIED });
    expect(planFromConnectError(new Error("could not establish pc connection"))).toEqual({
      engine: "text",
      reason: "voice unavailable: could not establish pc connection — keep typing.",
    });
  });
});
