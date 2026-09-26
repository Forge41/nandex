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
    expect(engineLabel(plan)).toBe("engine: livekit agent");
  });

  it("falls back to the browser on 503, 429 and network errors, carrying the detail", async () => {
    expect(planFromToken(await requestVoiceToken(respond(503, { detail: "voice is disabled", fallback: true })))).toEqual({
      engine: "browser",
      reason: "voice is disabled",
    });
    expect(planFromToken(await requestVoiceToken(respond(429, { detail: "slow down", fallback: true })))).toMatchObject({ engine: "browser" });
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const plan = planFromToken(await requestVoiceToken(offline));
    expect(plan).toEqual({ engine: "browser", reason: "voice service unreachable" });
    expect(engineLabel(plan)).toBe("engine: browser (fallback: voice service unreachable)");
  });

  it("drops to text when the mic is denied, and to the browser on other connect errors", () => {
    const denied = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    expect(planFromConnectError(denied)).toEqual({ engine: "text", reason: MIC_DENIED });
    expect(planFromConnectError(new Error("could not establish signal connection"))).toEqual({
      engine: "browser",
      reason: "could not establish signal connection",
    });
  });
});
