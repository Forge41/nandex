"use client";

import { AudioBars } from "@nandex/ui/audio-bars";
import { TypingCaret } from "@nandex/ui/indicators";
import { useEffect, useRef, useState } from "react";

import { recognitionCtor, speechText, waveLevels, type Recognition } from "@/lib/voice/speech";
import { HangUpIcon, MicIcon, MicOffIcon, StopIcon } from "./icons";
import { PhosphorPortrait } from "./phosphor-portrait";

const BARS = 56;
const GREETING = "Hi, I'm Nandisha's agent. Ask me anything about his work — RAG, agents, voice, MCP.";
const NOT_IN_DOCS = "That's not in my documents, so I won't guess. Leave a message with slash message.";

type Turn = { who: "you" | "agent"; text: string };

export function VoiceMode({
  theme,
  thinking,
  onAsk,
  onExit,
}: {
  theme: string;
  thinking: boolean;
  onAsk: (text: string) => Promise<string | null>;
  onExit: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [live, setLive] = useState("");
  const [micError, setMicError] = useState(() =>
    recognitionCtor() ? "" : "Speech recognition isn't available in this browser. Type in the terminal — I'll still read answers aloud.",
  );
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));

  const active = useRef(true);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const liveRef = useRef("");
  const rec = useRef<Recognition | null>(null);
  const waveTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ say: (text: string, done?: () => void) => void; listen: () => void }>({ say: () => {}, listen: () => {} });

  const after = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const wave = (energy: () => number, ms: number) => {
    clearInterval(waveTimer.current);
    waveTimer.current = setInterval(() => setLevels(waveLevels(BARS, energy())), ms);
  };
  const flat = () => {
    clearInterval(waveTimer.current);
    setLevels(Array(BARS).fill(0));
  };
  const stopRec = () => {
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    r.onend = null;
    try {
      r.stop();
    } catch {}
  };

  const turn = (who: Turn["who"], text: string) => setTurns((t) => [...t, { who, text }]);

  const say = (text: string, done?: () => void) => {
    const plain = speechText(text);
    turn("agent", plain);
    speakingRef.current = true;
    setSpeaking(true);
    setListening(false);
    wave(() => 0.7, 110);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      speakingRef.current = false;
      setSpeaking(false);
      flat();
      if (active.current && done) done();
    };
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      after(Math.min(6000, 1200 + plain.length * 28), finish);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(plain);
    u.rate = 1.03;
    u.pitch = 1;
    const v = synth.getVoices().find((x) => /en-(GB|IN|US)/.test(x.lang) && !/female/i.test(x.name));
    if (v) u.voice = v;
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
    after(Math.min(12000, 1500 + plain.length * 60), finish);
  };

  const listen = () => {
    if (!active.current || mutedRef.current || speakingRef.current) return;
    const SR = recognitionCtor();
    if (!SR) return;
    stopRec();
    const r = new SR();
    rec.current = r;
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onstart = () => {
      setListening(true);
      liveRef.current = "";
      setLive("");
      wave(() => (liveRef.current ? 0.9 : 0.25), 100);
    };
    r.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      liveRef.current = (finalText + " " + interim).trim();
      setLive(liveRef.current);
    };
    r.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setMicError("Microphone blocked. Allow the mic for this page, or type in the terminal — I'll read answers aloud.");
        mutedRef.current = true;
        setMuted(true);
      }
      if (ev.error === "network") {
        setMicError("Speech service unreachable. Type in the terminal — I'll read answers aloud.");
        mutedRef.current = true;
        setMuted(true);
      }
    };
    r.onend = () => {
      const t = (finalText || liveRef.current).trim();
      setListening(false);
      liveRef.current = "";
      setLive("");
      flat();
      if (rec.current !== r) return;
      rec.current = null;
      if (t) {
        turn("you", t);
        void onAsk(t).then((answer) => {
          if (active.current) say(answer ?? NOT_IN_DOCS, () => api.current.listen());
        });
      } else if (active.current && !mutedRef.current && !speakingRef.current) after(250, () => api.current.listen());
    };
    try {
      r.start();
    } catch {
      after(400, () => api.current.listen());
    }
  };

  useEffect(() => {
    api.current = { say, listen };
  });

  useEffect(() => {
    active.current = true;
    const t = setTimeout(() => api.current.say(GREETING, () => api.current.listen()), 500);
    const pending = timers.current;
    return () => {
      active.current = false;
      clearTimeout(t);
      pending.forEach(clearTimeout);
      clearInterval(waveTimer.current);
      stopRec();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    const c = scrollRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [turns]);

  const interrupt = () => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
    flat();
    listen();
  };

  const toggleMute = () => {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    if (m) {
      stopRec();
      flat();
      setListening(false);
      liveRef.current = "";
      setLive("");
    } else listen();
  };

  const tone = listening ? "var(--t-green)" : speaking ? "var(--t-accent)" : "var(--t-dim)";
  const animated = listening || speaking;
  const state = listening ? (live ? "hearing you…" : "listening") : speaking ? "speaking" : thinking ? "thinking" : muted ? "mic muted" : "idle";
  const ring = (inset: string, width: number, delay: string, idleColor: string): React.CSSProperties => ({
    position: "absolute",
    inset,
    borderRadius: "50%",
    border: `${width}px solid ${speaking ? "var(--t-accent)" : listening ? "var(--t-green)" : idleColor}`,
    animation: animated ? `tRing 1.4s ease-out ${delay} infinite` : "none",
  });

  return (
    <div
      data-screen-label="Voice simulator"
      role="dialog"
      aria-label="voice mode"
      className="absolute inset-0 z-[25] flex items-stretch justify-center bg-tm-bg"
      style={{ animation: "tFade .25s ease-out" }}
    >
      <div className="flex min-h-0 w-full max-w-[680px] flex-col" style={{ animation: "tReveal .35s cubic-bezier(.2,.8,.2,1)" }}>
        <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted" />
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
          {turns.map((t, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="w-11 flex-none" style={{ color: t.who === "you" ? "var(--t-green)" : "var(--t-accent)" }}>
                {t.who}
              </span>
              <span className="leading-[1.6] [overflow-wrap:anywhere]">{t.text}</span>
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
            className="t-reset inline-flex size-[38px] items-center justify-center border border-tm-border text-tm-sub hover:border-tm-accent hover:text-tm-accent"
            onClick={interrupt}
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
