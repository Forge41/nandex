export type VoiceToken = {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
  expiresIn: number;
  maxMinutes: number;
};

export type TokenResult = { ok: true; token: VoiceToken } | { ok: false; status: number | null; detail: string };

export type VoicePlan =
  | { engine: "livekit"; token: VoiceToken }
  | { engine: "browser"; reason: string }
  | { engine: "text"; reason: string };

export const MIC_DENIED = "microphone blocked — allow the mic to talk, or keep typing.";

export function planFromToken(res: TokenResult): VoicePlan {
  return res.ok ? { engine: "livekit", token: res.token } : { engine: "browser", reason: res.detail };
}

export function isMicDenied(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || /permission|not allowed|denied/i.test(err.message);
}

/** The browser sim needs the mic too, so a denied mic goes straight to typing. */
export function planFromConnectError(err: unknown): VoicePlan {
  if (isMicDenied(err)) return { engine: "text", reason: MIC_DENIED };
  return { engine: "browser", reason: err instanceof Error && err.message ? err.message : "could not reach the voice agent" };
}

export function engineLabel(plan: VoicePlan | null): string {
  if (!plan) return "engine: connecting…";
  if (plan.engine === "livekit") return "engine: livekit agent";
  if (plan.engine === "browser") return `engine: browser (fallback: ${plan.reason})`;
  return `engine: text (${plan.reason})`;
}

export function parseToken(body: unknown): VoiceToken | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.token !== "string" || typeof b.ws_url !== "string" || typeof b.identity !== "string") return null;
  return {
    token: b.token,
    wsUrl: b.ws_url,
    roomName: typeof b.room_name === "string" ? b.room_name : "",
    identity: b.identity,
    expiresIn: typeof b.expires_in === "number" ? b.expires_in : 0,
    maxMinutes: typeof b.max_minutes === "number" ? b.max_minutes : 0,
  };
}
