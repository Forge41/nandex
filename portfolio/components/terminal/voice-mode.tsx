"use client";

import { AudioBars } from "@nandex/ui/audio-bars";
import { TypingCaret } from "@nandex/ui/indicators";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { requestVoiceToken } from "@/lib/api/portfolio";
import { engineLabel, planFromToken, type TokenResult, type VoicePlan } from "@/lib/voice/plan";
import type { VoiceTurn } from "@/lib/voice/transcripts";
import { useNow } from "./hooks";
import { HangUpIcon, MicIcon, MicOffIcon, StopIcon } from "./icons";
import { PhosphorPortrait } from "./phosphor-portrait";
import { BARS, useLivekitVoice } from "./use-livekit-voice";

const pad = (n: number) => String(n).padStart(2, "0");

export function VoiceMode({
  theme,
  thinking,
  verbose,
  onExit,
  onEnded,
  onStatus,
  onTranscript,
}: {
  theme: string;
  thinking: boolean;
  verbose: boolean;
  onExit: () => void;
  onEnded: (note: string) => void;
  onStatus: (msg: string) => void;
  onTranscript: (turns: VoiceTurn[]) => void;
}) {
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  const choose = (next: VoicePlan) => {
    if (next.engine === "text") return onEnded(next.reason);
    setPlan(next);
    onStatus("voice: live agent · esc to end");
  };
  const chooseFromToken = useEffectEvent(choose);

  // One request per open even when React runs this effect twice: each token is a room
  // and counts against the visitor's daily voice limit.
  const tokenRequest = useRef<Promise<TokenResult> | null>(null);
  useEffect(() => {
    let live = true;
    tokenRequest.current ??= requestVoiceToken();
    void tokenRequest.current.then((res) => live && chooseFromToken(planFromToken(res)));
    return () => {
      live = false;
    };
  }, []);

  const lk = useLivekitVoice(plan?.engine === "livekit" ? plan.token : null, {
    onFail: (next) => choose(next),
    onEnded: () => onEnded("voice ended — keep typing"),
  });
  const { turns, listening, speaking, muted, levels, live, micError, toggleMute, interrupt } = lk;

  const turnsRef = useRef<VoiceTurn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
    const c = scrollRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [turns]);

  const handOff = useEffectEvent(() => onTranscript(turnsRef.current.filter((t) => t.final)));
  useEffect(() => () => handOff(), []);

  const remaining =
    plan?.engine === "livekit" && lk.connectedAt && plan.token.maxMinutes
      ? Math.max(0, lk.connectedAt + plan.token.maxMinutes * 60000 - now)
      : null;
  const limitLabel =
    remaining != null ? `${Math.floor(remaining / 60000)}:${pad(Math.floor(remaining / 1000) % 60)} left` : "";

  const tone = listening ? "var(--t-green)" : speaking ? "var(--t-accent)" : "var(--t-dim)";
  const animated = listening || speaking;
  const state = !plan ? "connecting…" : listening ? (live ? "hearing you…" : "listening") : speaking ? "speaking" : thinking ? "thinking" : muted ? "mic muted" : "idle";
  const ring = (inset: string, width: number, delay: string, idleColor: string): React.CSSProperties => ({
    position: "absolute",
    inset,
    borderRadius: "50%",
    border: `${width}px solid ${speaking ? "var(--t-accent)" : listening ? "var(--t-green)" : idleColor}`,
    animation: animated ? `tRing 1.4s ease-out ${delay} infinite` : "none",
  });

  return (
    <div
      data-screen-label="Voice"
      role="dialog"
      aria-label="voice mode"
      className="absolute inset-0 z-[25] flex items-stretch justify-center bg-tm-bg"
      style={{ animation: "tFade .25s ease-out" }}
      onClick={lk.startAudio}
    >
      <div className="flex min-h-0 w-full max-w-[680px] flex-col" style={{ animation: "tReveal .35s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
          <span className="tabular-nums">{limitLabel}</span>
          <span className="flex-1" />
          {verbose && <span className="truncate normal-case tracking-normal text-tm-dim">{engineLabel(plan)}</span>}
        </div>
        <div className="flex flex-none flex-col items-center gap-3.5 px-4 pb-[18px] pt-[34px] max-[859px]:pt-5">
          <div className="relative flex size-[236px] items-center justify-center max-[859px]:size-[180px]">
            <span style={ring("0", 2, "0s", "var(--t-border)")} />
            <span style={ring("-10px", 1, ".5s", "transparent")} />
            <div
              className="flex size-[212px] items-center justify-center overflow-hidden rounded-full border border-tm-border bg-tm-bg max-[859px]:size-[160px]"
              style={{ boxShadow: speaking ? "0 0 32px var(--t-hl)" : "none" }}
            >
              <PhosphorPortrait theme={theme} className="size-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-tm-sub" aria-live="polite">
            <span
              className="size-2 rounded-full"
              style={{ background: tone, animation: animated ? "tPulse 1.2s ease-in-out infinite" : "none" }}
            />
            <span>{state}</span>
          </div>
          <AudioBars
            barCount={BARS}
            barWidth={3}
            gap={2}
            levels={levels}
            className="h-[18px] max-w-full overflow-hidden"
            style={{ color: tone, filter: animated ? "drop-shadow(0 0 5px currentColor)" : "none" }}
          />
        </div>
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto px-7 pb-3 pt-2 text-[13px] max-[859px]:px-4">
          {turns.map((t) => (
            <div key={t.id} className="flex gap-2.5" style={t.final ? undefined : { color: "var(--t-muted)" }}>
              <span className="w-11 flex-none" style={{ color: t.who === "you" ? "var(--t-green)" : "var(--t-accent)" }}>
                {t.who}
              </span>
              <span className="leading-[1.6] [overflow-wrap:anywhere]">
                {t.text}
                {!t.final && <TypingCaret height={13} className="ml-[3px]" style={{ background: "var(--t-green)" }} />}
              </span>
            </div>
          ))}
          {live && (
            <div className="flex gap-2.5 text-tm-muted">
              <span className="w-11 flex-none text-tm-green">you</span>
              <span className="[overflow-wrap:anywhere]">
                {live}
                <TypingCaret height={13} className="ml-[3px]" style={{ background: "var(--t-green)" }} />
              </span>
            </div>
          )}
          {micError && (
            <div className="border border-l-2 border-tm-border border-l-tm-accent px-2.5 py-2 text-xs leading-[1.5] text-tm-sub">{micError}</div>
          )}
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-tm-border px-5 py-2.5">
          <button
            type="button"
            title={muted ? "unmute mic" : "mute mic"}
            aria-label={muted ? "unmute mic" : "mute mic"}
            aria-pressed={muted}
            className="t-reset inline-flex size-[38px] items-center justify-center border"
            style={{
              borderColor: muted ? "var(--t-accent)" : "var(--t-border)",
              color: muted ? "var(--t-accent)" : "var(--t-sub)",
              background: muted ? "var(--t-hl)" : "transparent",
            }}
            onClick={toggleMute}
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
          <button
            type="button"
            title="stop talking"
            aria-label="stop talking"
            disabled={!interrupt}
            className="t-reset inline-flex size-[38px] items-center justify-center border border-tm-border text-tm-sub hover:border-tm-accent hover:text-tm-accent disabled:cursor-default disabled:opacity-40"
            onClick={() => interrupt?.()}
          >
            <StopIcon />
          </button>
          <span className="flex-1" />
          <button
            type="button"
            title="end voice mode"
            aria-label="end voice mode"
            className="t-reset inline-flex size-[38px] items-center justify-center border border-tm-red text-tm-red hover:bg-tm-red hover:text-tm-bg"
            onClick={onExit}
          >
            <HangUpIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
