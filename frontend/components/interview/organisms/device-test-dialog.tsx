"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioBars } from "@/components/ui/audio-bars";
import { useMicTest, type MediaTestStatus } from "@/lib/interview/media/use-mic-test";
import { useCameraTest, LIGHTING_COPY } from "@/lib/interview/media/use-camera-test";
import type { DeviceStatus } from "@/lib/interview/types";

export type DeviceTestKind = "mic" | "camera";

/** Panels report upward so the device rows can show a real verdict instead of
 * decorative motion, which in a device check would read as "this works". */
type VerdictProps = { onVerdict: (status: DeviceStatus) => void };

/** Read-only: the browser only reveals device labels after permission, and
 * switching devices needs a picker the pre-flight doesn't have yet. Showing
 * which device is actually live is the useful half. */
function ActiveDevice({ label, fallback }: { label: string | null; fallback: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-content-subtle">In use</span>
      <div className="flex h-9 items-center rounded-md border border-transparent bg-surface-input px-3 text-sm">
        {label || fallback}
      </div>
    </div>
  );
}

function StatusStrip({
  tone,
  children,
  badge,
}: {
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
  badge: string;
}) {
  const surface = tone === "success" ? "bg-success-bg" : tone === "warning" ? "bg-warning-bg" : "bg-danger-bg";
  const text = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";

  return (
    <div className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ${surface}`}>
      <span className={`text-sm ${text}`}>{children}</span>
      <Badge tone={tone} size="sm">
        {badge}
      </Badge>
    </div>
  );
}

function FailureNote({ status, message }: { status: MediaTestStatus; message: string | null }) {
  if (status === "requesting") {
    return <p className="text-sm text-content-subtle">Waiting for permission…</p>;
  }
  return <StatusStrip tone="danger" badge={status === "denied" ? "Blocked" : "Failed"}>{message}</StatusStrip>;
}

function MicTestPanel({ onVerdict }: VerdictProps) {
  const mic = useMicTest(true);
  const running = mic.status === "running";
  const tooQuiet = mic.peakDb === null || mic.peakDb < -45;

  const verdict: DeviceStatus = !running
    ? mic.status === "requesting"
      ? "untested"
      : "fail"
    : mic.clipping || tooQuiet
      ? "check"
      : "ok";

  useEffect(() => onVerdict(verdict), [verdict, onVerdict]);

  return (
    <div className="px-5 py-[22px]">
      <p className="text-base text-content-subtle">
        Say a few words at your normal speaking volume. You should see the bars move.
      </p>

      <div className="mt-5 flex h-[120px] items-center justify-center rounded-lg bg-surface-interactive">
        {/* Flat when the mic isn't actually open: motion here would say the
            microphone works while the panel says it is blocked. */}
        <AudioBars
          barWidth={8}
          gap={8}
          className="h-16 text-content-on-interactive"
          levels={running ? mic.levels : [0.05, 0.05, 0.05, 0.05, 0.05]}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <ActiveDevice label={mic.deviceLabel} fallback="System microphone" />

        {running ? (
          mic.clipping ? (
            <StatusStrip tone="warning" badge="Check">
              Clipping at {mic.peakDb?.toFixed(0)} dB — move back from the mic or lower its input gain
            </StatusStrip>
          ) : tooQuiet ? (
            <StatusStrip tone="warning" badge="Quiet">
              No speech detected yet — say a few words
            </StatusStrip>
          ) : (
            <StatusStrip tone="success" badge="Pass">
              Level healthy · peak {mic.peakDb?.toFixed(0)} dB, no clipping
            </StatusStrip>
          )
        ) : (
          <FailureNote status={mic.status} message={mic.errorMessage} />
        )}
      </div>
    </div>
  );
}

function CameraTestPanel({ onVerdict }: VerdictProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camera = useCameraTest(true, videoRef);
  const running = camera.status === "running";

  const verdict: DeviceStatus = !running
    ? camera.status === "requesting"
      ? "untested"
      : "fail"
    : camera.lighting === null
      ? "untested"
      : camera.lighting === "good"
        ? "ok"
        : "check";

  useEffect(() => onVerdict(verdict), [verdict, onVerdict]);

  return (
    <div className="px-5 py-[22px]">
      <p className="text-base text-content-subtle">
        Check your framing and lighting. Keep your face inside the guide.
      </p>

      <div className="bg-stripes relative mt-5 flex h-[240px] items-center justify-center overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          muted
          playsInline
          className="size-full object-cover"
          // Mirrored so the candidate sees themselves as in a mirror, which is
          // what every other video tool does.
          style={{ transform: "scaleX(-1)" }}
        />
        <span className="pointer-events-none absolute h-[170px] w-[130px] rounded-t-[80px] rounded-b-[70px] border-[1.5px] border-dashed border-content-muted" />
        {running && camera.resolution && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium">
            {camera.resolution.height}p{camera.frameRate ? ` · ${camera.frameRate} fps` : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <ActiveDevice label={camera.deviceLabel} fallback="System camera" />

        {running ? (
          camera.lighting === null ? (
            <p className="text-sm text-content-subtle">Checking lighting…</p>
          ) : (
            <StatusStrip
              tone={camera.lighting === "good" ? "success" : "warning"}
              badge={camera.lighting === "good" ? "Pass" : "Check"}
            >
              {LIGHTING_COPY[camera.lighting]}
            </StatusStrip>
          )
        ) : (
          <FailureNote status={camera.status} message={camera.errorMessage} />
        )}
      </div>
    </div>
  );
}

export function DeviceTestDialog({
  kind,
  onClose,
  onVerdict,
}: {
  kind: DeviceTestKind | null;
  onClose: () => void;
  onVerdict: (kind: DeviceTestKind, status: DeviceStatus) => void;
}) {
  // Remounting per open is what keeps the media hooks from having to reset
  // their own state -- a fresh open gets a fresh acquisition.
  const [runId, setRunId] = useState(0);

  // Stable identities: the panels report from an effect keyed on the verdict,
  // so a fresh closure each render would re-fire it on every level sample.
  const reportMic = useCallback((status: DeviceStatus) => onVerdict("mic", status), [onVerdict]);
  const reportCamera = useCallback((status: DeviceStatus) => onVerdict("camera", status), [onVerdict]);

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="block w-[520px] gap-0 overflow-hidden rounded-xl border-line-strong bg-surface p-0 sm:max-w-[520px]"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <DialogTitle className="flex-1 text-md leading-normal font-medium">
            {kind === "mic" ? "Microphone test" : "Camera test"}
          </DialogTitle>
          <Button variant="ghost" size="sm" className="text-content-subtle" onClick={onClose}>
            Close
          </Button>
        </div>

        {kind === "mic" && <MicTestPanel key={runId} onVerdict={reportMic} />}
        {kind === "camera" && <CameraTestPanel key={runId} onVerdict={reportCamera} />}

        <div className="flex items-center gap-2.5 border-t border-line bg-surface-subtle px-5 py-3.5">
          <Button variant="secondary" size="sm" onClick={() => setRunId((id) => id + 1)}>
            Run test again
          </Button>
          <span className="flex-1" />
          <Button variant="primary" size="sm" onClick={onClose}>
            Looks good
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
