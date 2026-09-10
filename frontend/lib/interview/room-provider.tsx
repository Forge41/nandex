"use client";

import { createContext, useContext, useMemo, useState } from "react";

/** Client-only room state: what the candidate has toggled, and which local
 * tracks are live.
 *
 * The media half is deliberately behind this interface. Today it is plain
 * state, because before the room is joined there is nothing to publish to;
 * when LiveKit lands, the internals move to its track hooks and the control
 * bar and the pre-flight device rows keep reading from the same place. */
export interface RoomState {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreen: () => void;

  captionsEnabled: boolean;
  toggleCaptions: () => void;

  interviewerVoiceEnabled: boolean;
  toggleInterviewerVoice: () => void;

  panelOpen: boolean;
  togglePanel: () => void;
}

const RoomContext = createContext<RoomState | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [micEnabled, setMic] = useState(true);
  const [cameraEnabled, setCamera] = useState(true);
  const [screenEnabled, setScreen] = useState(true);
  const [captionsEnabled, setCaptions] = useState(false);
  const [interviewerVoiceEnabled, setVoice] = useState(true);
  const [panelOpen, setPanel] = useState(true);

  const value = useMemo<RoomState>(
    () => ({
      micEnabled,
      cameraEnabled,
      screenEnabled,
      toggleMic: () => setMic((v) => !v),
      toggleCamera: () => setCamera((v) => !v),
      toggleScreen: () => setScreen((v) => !v),
      captionsEnabled,
      toggleCaptions: () => setCaptions((v) => !v),
      interviewerVoiceEnabled,
      toggleInterviewerVoice: () => setVoice((v) => !v),
      panelOpen,
      togglePanel: () => setPanel((v) => !v),
    }),
    [micEnabled, cameraEnabled, screenEnabled, captionsEnabled, interviewerVoiceEnabled, panelOpen]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomState() {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoomState must be used inside RoomProvider");
  return value;
}
