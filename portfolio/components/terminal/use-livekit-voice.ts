"use client";

import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from "livekit-client";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { planFromConnectError, type VoicePlan, type VoiceToken } from "@/lib/voice/plan";
import { waveLevels } from "@/lib/voice/levels";
import { segmentFromStream, segmentsToTurns, upsertSegment, type Segment, type VoiceTurn } from "@/lib/voice/transcripts";

const TOPIC = "lk.transcription";

export const BARS = 56;
const flatLevels = () => Array<number>(BARS).fill(0);

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

export type LivekitHandlers = {
  /** Connecting failed before the conversation started; the caller picks the next engine. */
  onFail: (plan: VoicePlan) => void;
  /** The room closed underneath us: the agent hit its time limit, left, or the connection dropped. */
  onEnded: () => void;
};

export function useLivekitVoice(
  token: VoiceToken | null,
  handlers: LivekitHandlers,
): VoiceEngineState & { connectedAt: number | null; startAudio: () => void } {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [levels, setLevels] = useState<number[]>(flatLevels);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mutedRef = useRef(false);

  const fail = useEffectEvent((plan: VoicePlan) => handlers.onFail(plan));
  const ended = useEffectEvent(() => handlers.onEnded());

  useEffect(() => {
    if (!token) return;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const audioEls = new Map<string, HTMLMediaElement>();
    let closing = false;
    let started = false;
    let meter: ReturnType<typeof setInterval> | undefined;

    void room.startAudio().catch(() => undefined);

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      audioEls.set(track.sid ?? String(audioEls.size), el);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove());
    });
    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      if (p.identity !== token.identity && room.remoteParticipants.size === 0) void room.disconnect();
    });
    room.on(RoomEvent.Disconnected, () => {
      clearInterval(meter);
      if (!closing && started) ended();
    });
    room.on(RoomEvent.MediaDevicesError, (e: Error) => {
      if (closing) return;
      const plan = planFromConnectError(e);
      if (plan.engine === "text") {
        closing = true;
        void room.disconnect();
        fail(plan);
      }
    });

    room.registerTextStreamHandler(TOPIC, (reader, participant) => {
      void (async () => {
        let text = "";
        for await (const chunk of reader) {
          text += chunk;
          const seg = segmentFromStream(reader.info, participant.identity, text);
          setSegments((s) => upsertSegment(s, seg));
        }
      })().catch(() => undefined);
    });

    void (async () => {
      try {
        await room.connect(token.wsUrl, token.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (closing) return;
        started = true;
        setConnectedAt(Date.now());
        void room.startAudio().catch(() => undefined);
        meter = setInterval(() => {
          const agent = [...room.remoteParticipants.values()][0];
          const agentLevel = agent?.audioLevel ?? 0;
          const talking = !!agent && (agent.isSpeaking || agentLevel > 0.02);
          const mic = room.localParticipant.audioLevel;
          setSpeaking(talking);
          setListening(!talking && !mutedRef.current);
          setLevels(
            talking
              ? waveLevels(BARS, Math.min(1, 0.3 + agentLevel * 4))
              : mutedRef.current
                ? flatLevels()
                : waveLevels(BARS, Math.min(1, 0.2 + mic * 5)),
          );
        }, 100);
      } catch (e) {
        if (closing) return;
        closing = true;
        void room.disconnect();
        fail(planFromConnectError(e));
      }
    })();

    return () => {
      closing = true;
      clearInterval(meter);
      room.unregisterTextStreamHandler(TOPIC);
      void room.disconnect(true);
      audioEls.forEach((el) => el.remove());
      roomRef.current = null;
    };
  }, [token]);

  const turns = useMemo(() => (token ? segmentsToTurns(segments, token.identity) : []), [segments, token]);

  const toggleMute = () => {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!m).catch(() => undefined);
  };

  return {
    turns,
    listening,
    speaking,
    muted,
    levels,
    live: "",
    micError: "",
    toggleMute,
    interrupt: null,
    connectedAt,
    startAudio: () => void roomRef.current?.startAudio().catch(() => undefined),
  };
}
