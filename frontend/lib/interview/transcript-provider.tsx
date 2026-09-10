"use client";

import { createContext, useContext } from "react";
import type { TranscriptTurn } from "./types";

const TranscriptContext = createContext<TranscriptTurn[] | null>(null);

/** The side panel and the behavioural round render the same turns at different
 * densities, so the stream lives here rather than being drilled through the
 * room shell. Becomes the LiveKit transcription subscription later. */
export function TranscriptProvider({
  turns,
  children,
}: {
  turns: TranscriptTurn[];
  children: React.ReactNode;
}) {
  return <TranscriptContext.Provider value={turns}>{children}</TranscriptContext.Provider>;
}

export function useTranscript() {
  const value = useContext(TranscriptContext);
  if (!value) throw new Error("useTranscript must be used inside TranscriptProvider");
  return value;
}
