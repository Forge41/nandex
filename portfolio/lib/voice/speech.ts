type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative };

export type RecognitionResultEvent = { resultIndex: number; results: ArrayLike<Result> };
export type RecognitionErrorEvent = { error: string };

export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((ev: RecognitionResultEvent) => void) | null;
  onerror: ((ev: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechText = (text: string) => text.replace(/\s*\[\d+\]/g, "").replace(/[◆•]/g, "");

export function waveLevels(count: number, energy: number, rnd: () => number = Math.random): number[] {
  return Array.from({ length: count }, (_, i) => {
    const env = Math.sin((i / count) * Math.PI);
    return Math.max(0, Math.min(1, env * energy * (0.35 + rnd() * 0.9)));
  });
}
