"use client";

import { useEffect, useRef, useState } from "react";

import { recognitionCtor, speechText, waveLevels, type Recognition } from "@/lib/voice/speech";
import type { VoiceTurn } from "@/lib/voice/transcripts";

export const BARS = 56;
const GREETING = "Hi, I'm Nandisha's agent. Ask me anything about his work — RAG, agents, voice, MCP.";
const NOT_IN_DOCS = "That's not in my documents, so I won't guess. Leave a message with slash message.";
const NO_SR = "Speech recognition isn't available in this browser. Type in the terminal — I'll still read answers aloud.";

export const flatLevels = () => Array<number>(BARS).fill(0);

export type VoiceEngineState = {
  turns: VoiceTurn[];
  listening: boolean;
  speaking: boolean;
  muted: boolean;
  levels: number[];
  live: string;
  micError: string;
  toggleMute: () => void;
  interrupt: (() => void) | null;
};

/** Browser SpeechRecognition + speechSynthesis loop; the fallback when the LiveKit agent is unavailable. */
export function useBrowserVoice(enabled: boolean, onAsk: (text: string) => Promise<string | null>): VoiceEngineState {
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [live, setLive] = useState("");
  const [micError, setMicError] = useState("");
  const [levels, setLevels] = useState<number[]>(flatLevels);

  const active = useRef(false);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const liveRef = useRef("");
  const rec = useRef<Recognition | null>(null);
  const waveTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const turnId = useRef(0);
  const api = useRef<{ say: (text: string, done?: () => void) => void; listen: () => void }>({ say: () => {}, listen: () => {} });

  const after = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const wave = (energy: () => number, ms: number) => {
    clearInterval(waveTimer.current);
    waveTimer.current = setInterval(() => setLevels(waveLevels(BARS, energy())), ms);
  };
  const flat = () => {
    clearInterval(waveTimer.current);
    setLevels(flatLevels());
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
  const turn = (who: VoiceTurn["who"], text: string) =>
    setTurns((t) => [...t, { id: `b${turnId.current++}`, who, text, final: true }]);

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
    const synth = window.speechSynthesis;
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

  const blockMic = (message: string) => {
    setMicError(message);
    mutedRef.current = true;
    setMuted(true);
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
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed")
        blockMic("Microphone blocked. Allow the mic for this page, or type in the terminal — I'll read answers aloud.");
      if (ev.error === "network") blockMic("Speech service unreachable. Type in the terminal — I'll read answers aloud.");
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
    if (!enabled) return;
    active.current = true;
    const pending = timers.current;
    const t = setTimeout(() => {
      if (!recognitionCtor()) setMicError(NO_SR);
      api.current.say(GREETING, () => api.current.listen());
    }, 500);
    return () => {
      active.current = false;
      clearTimeout(t);
      pending.forEach(clearTimeout);
      clearInterval(waveTimer.current);
      const r = rec.current;
      rec.current = null;
      if (r) {
        r.onend = null;
        try {
          r.stop();
        } catch {}
      }
      window.speechSynthesis?.cancel();
    };
  }, [enabled]);

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

  return { turns, listening, speaking, muted, levels, live, micError, toggleMute, interrupt };
}
