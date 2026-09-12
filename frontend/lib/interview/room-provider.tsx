"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useAudioPlayback,
  useConnectionQualityIndicator,
  useConnectionState,
  useIsRecording,
  useLocalParticipant,
  useMultibandTrackVolume,
  useSession,
  useTrackToggle,
} from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, Track, TokenSource } from "livekit-client";
// Re-exported by components-react; components-core is a transitive dependency
// and importing it directly would pin a version nothing declares.
import type { TrackReference } from "@livekit/components-react";
import { apiFetch } from "@/lib/api/client";
import type { StageId } from "./types";

/** Rounds that join a real room. A set rather than an inequality so a stage can
 * never drift into it by accident: useSession calls prepareConnection() on
 * mount, which mints a token, so it must not be mounted during pre-flight. */
export const LIVE_STAGES: ReadonlySet<StageId> = new Set<StageId>(["behavioral"]);

export type RoomConnection = "offline" | "connecting" | "live" | "degraded" | "failed" | "ended";

/** Client-only room state: what the candidate has toggled, and which local
 * tracks are live.
 *
 * The media half is behind this interface so the control bar and the pre-flight
 * device rows read from one place whether or not a room is joined. On a live
 * round the values come from LiveKit; on every other round they are plain state,
 * because there is nothing to publish to. */
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

  /** Where the room actually is. "offline" on a round that joins nothing. */
  connection: RoomConnection;
  /** LiveKit's bucketed quality, never a synthesised millisecond figure. */
  quality?: ConnectionQuality;
  /** The interviewer's own state, for the voice pill and the connection copy. */
  agentState?: string;
  /** The interviewer's participant identity, as reported by the room. Never
   * constructed: the agent joins under whatever identity its worker sets, so
   * guessing the format here would silently mislabel every transcription. */
  agentIdentity?: string;
  /** Per-band levels of the interviewer's voice, or undefined with no track --
   * the bars self-animate rather than sitting flat when there is nothing to
   * measure. */
  agentLevels?: number[];
  /** The candidate's published camera, for the self-view. */
  selfCameraTrack?: TrackReference;
  /** A device is mid-acquisition, so its control should not look settled. */
  devicePending: boolean;
  /** Whether the provider says a recording is running. The only truthful source
   * for the REC badge: our own state can only say what we asked for. */
  isRecording: boolean;
  /** Browsers block audio before a user gesture, and a candidate can reach this
   * round without having clicked in the document. */
  audioBlocked: boolean;
  unblockAudio: () => void;
  retry: () => void;
}

const RoomStateContext = createContext<RoomState | null>(null);

/** The toggles that exist on every round, live or not. */
function useRoomChrome() {
  const [captionsEnabled, setCaptions] = useState(false);
  const [interviewerVoiceEnabled, setVoice] = useState(true);
  const [panelOpen, setPanel] = useState(true);

  return useMemo(
    () => ({
      captionsEnabled,
      toggleCaptions: () => setCaptions((v) => !v),
      interviewerVoiceEnabled,
      toggleInterviewerVoice: () => setVoice((v) => !v),
      panelOpen,
      togglePanel: () => setPanel((v) => !v),
    }),
    [captionsEnabled, interviewerVoiceEnabled, panelOpen]
  );
}

function LocalRoomState({ children }: { children: React.ReactNode }) {
  const chrome = useRoomChrome();
  const [micEnabled, setMic] = useState(true);
  const [cameraEnabled, setCamera] = useState(true);
  // Starts off, unlike mic and camera: the design's bar showed it on, which
  // claimed a share that was never happening.
  const [screenEnabled, setScreen] = useState(false);

  const value = useMemo<RoomState>(
    () => ({
      ...chrome,
      micEnabled,
      cameraEnabled,
      screenEnabled,
      toggleMic: () => setMic((v) => !v),
      toggleCamera: () => setCamera((v) => !v),
      toggleScreen: () => setScreen((v) => !v),
      connection: "offline",
      devicePending: false,
      isRecording: false,
      audioBlocked: false,
      unblockAudio: () => {},
      retry: () => {},
    }),
    [chrome, micEnabled, cameraEnabled, screenEnabled]
  );

  return <RoomStateContext.Provider value={value}>{children}</RoomStateContext.Provider>;
}

function deriveConnection(
  state: ConnectionState,
  agentState: string,
  quality: ConnectionQuality,
  startFailed: boolean
): RoomConnection {
  // Disconnected means two different things and the copy differs, so the reason
  // is carried rather than guessed: a candidate who never got in must not be
  // told they left.
  if (state === ConnectionState.Disconnected) return startFailed ? "failed" : "ended";
  if (state === ConnectionState.Connecting) return "connecting";
  if (agentState === "failed") return "failed";
  // Connected to the room is not the same as ready to be interviewed: until the
  // agent is listening there is nobody to talk to, and saying "live" then would
  // be the fabrication the whole connection banner exists to avoid.
  if (agentState === "connecting" || agentState === "initializing") return "connecting";
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
    return "degraded";
  }
  if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) return "degraded";
  return "live";
}

/** Assembles RoomState from LiveKit's hooks. Must sit inside SessionProvider,
 * which provides both the session and the room every useEnsureRoom hook needs. */
function LiveRoomBridge({
  session,
  startFailed,
  onRetry,
  children,
}: {
  session: ReturnType<typeof useSession>;
  startFailed: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const chrome = useRoomChrome();
  const agent = useAgent();
  const connectionState = useConnectionState();
  // Connection quality is per-participant, so the local one is passed
  // explicitly: with no ParticipantContext above us the hook throws rather
  // than defaulting, and SessionProvider supplies only session and room.
  const { localParticipant } = useLocalParticipant({ room: session.room });
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const isRecording = useIsRecording();

  // 64ms rather than the 32ms default: this re-renders the control bar, and the
  // bars are 5 coarse levels -- twice a frame is more than the eye reads.
  const bands = useMultibandTrackVolume(agent.microphoneTrack, { bands: 5, updateInterval: 64 });

  // Derived from LiveKit, never mirrored into state: a failed getUserMedia or a
  // yanked device flips the control back by itself, with no sync effect.
  // Destructured so the memo below can depend on the fields it actually reads
  // rather than on three objects that are new every render.
  const { enabled: micEnabled, pending: micPending, toggle: toggleMicTrack } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const { enabled: cameraEnabled, pending: cameraPending, toggle: toggleCameraTrack } =
    useTrackToggle({ source: Track.Source.Camera });
  const { enabled: screenEnabled, pending: screenPending, toggle: toggleScreenTrack } =
    useTrackToggle({ source: Track.Source.ScreenShare });

  // useAudioPlayback rather than useStartAudio: the latter returns button props
  // for LiveKit's own prefab, not a function to call from ours.
  const { canPlayAudio, startAudio } = useAudioPlayback(session.room);

  const value = useMemo<RoomState>(
    () => ({
      ...chrome,
      micEnabled: Boolean(micEnabled),
      cameraEnabled: Boolean(cameraEnabled),
      screenEnabled: Boolean(screenEnabled),
      // toggle() is async; RoomState promises void, so the promise is swallowed
      // here rather than widening the interface every consumer reads.
      toggleMic: () => void toggleMicTrack(),
      toggleCamera: () => void toggleCameraTrack(),
      toggleScreen: () => void toggleScreenTrack(),
      connection: deriveConnection(connectionState, agent.state, quality, startFailed),
      quality,
      agentState: agent.state,
      agentIdentity: agent.identity,
      // Undefined with no track, so AudioBars self-animates: a real
      // [0,0,0,0,0] would flatten the bars and read as a dead interviewer.
      agentLevels: agent.microphoneTrack ? bands : undefined,
      selfCameraTrack: session.local.cameraTrack,
      devicePending: Boolean(micPending || cameraPending || screenPending),
      isRecording,
      audioBlocked: !canPlayAudio,
      unblockAudio: () => void startAudio(),
      retry: onRetry,
    }),
    [
      chrome,
      micEnabled,
      toggleMicTrack,
      micPending,
      cameraEnabled,
      toggleCameraTrack,
      cameraPending,
      screenEnabled,
      toggleScreenTrack,
      screenPending,
      connectionState,
      startFailed,
      agent.state,
      agent.identity,
      agent.microphoneTrack,
      bands,
      quality,
      session.local.cameraTrack,
      isRecording,
      canPlayAudio,
      startAudio,
      onRetry,
    ]
  );

  return (
    <RoomStateContext.Provider value={value}>
      {/* Muting rather than dropping the volume: a muted element neither plays
          nor pulls bandwidth, and the bars going flat is the honest signal. */}
      <RoomAudioRenderer muted={!chrome.interviewerVoiceEnabled} />
      {children}
    </RoomStateContext.Provider>
  );
}

function LiveRoomState({ sessionId, children }: { sessionId: string; children: React.ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  // Compared against the current attempt rather than reset on retry, so the
  // effect below never sets state synchronously -- this lint config treats that
  // as an error, and rightly: a reset would render one frame of stale success.
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);

  const tokenSource = useMemo(() => {
    // A holder rather than a reassigned closure variable: react-hooks/immutability
    // rejects reassignment inside an async function, and rightly -- this is
    // deliberately per-token-source memory, not render state.
    const cache: { minted: { serverUrl: string; participantToken: string } | null } = {
      minted: null,
    };

    return TokenSource.custom(async () => {
      try {
        const minted = await apiFetch<{ token: string; ws_url: string }>(
          `/interview/sessions/${sessionId}/token`,
          { method: "POST" }
        );
        // TokenSource.custom caches and re-fetches off the JWT's own exp, not
        // off any expiry we report alongside it.
        cache.minted = { serverUrl: minted.ws_url, participantToken: minted.token };
        return cache.minted;
      } catch (error) {
        // useSession force-refetches a token on every disconnect and does not
        // await it, so a rejection there escapes as an unhandled rejection --
        // once per failed attempt. Returning the last credentials keeps that
        // path quiet, and nothing consumes them: the room is already going away.
        if (cache.minted) return cache.minted;
        // Nothing cached means this is the first connect, which our own effect
        // awaits and turns into the banner.
        throw error;
      }
    });
  }, [sessionId]);

  const session = useSession(tokenSource);

  useEffect(() => {
    const controller = new AbortController();
    session.start({ signal: controller.signal }).catch(() => {
      // Records why the room ended up disconnected. The connection state alone
      // cannot say whether the candidate never arrived or has left.
      setFailedAttempt(attempt);
    });
    return () => {
      controller.abort();
      void session.end();
    };
    // session.start identity changes with the room; re-running on `attempt` is
    // what Retry does. Deliberately not depending on `session` itself, which
    // would reconnect on every render of a changing object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, sessionId]);

  return (
    <SessionProvider session={session}>
      <LiveRoomBridge
        session={session}
        startFailed={failedAttempt === attempt}
        onRetry={() => setAttempt((n) => n + 1)}
      >
        {children}
      </LiveRoomBridge>
    </SessionProvider>
  );
}

export function RoomProvider({
  sessionId,
  activeStage,
  children,
}: {
  sessionId: string;
  activeStage: StageId;
  children: React.ReactNode;
}) {
  // Remounting on the switch is deliberate: the live implementation owns a real
  // connection, and leaving it mounted through the coding round would hold a
  // room open for a candidate who is not in it.
  if (LIVE_STAGES.has(activeStage)) {
    return (
      <LiveRoomState key={`live-${sessionId}`} sessionId={sessionId}>
        {children}
      </LiveRoomState>
    );
  }
  return <LocalRoomState key="local">{children}</LocalRoomState>;
}

export function useRoomState() {
  const value = useContext(RoomStateContext);
  if (!value) throw new Error("useRoomState must be used inside RoomProvider");
  return value;
}
