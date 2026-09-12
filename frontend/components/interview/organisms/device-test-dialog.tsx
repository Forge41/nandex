"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioBars } from "@/components/ui/audio-bars";
import { StreamVideo } from "@/components/interview/molecules/device-preview";
import { LIGHTING_COPY } from "@/lib/interview/media/use-camera-test";
import { REQUIRED_SPEECH_SECONDS } from "@/lib/interview/media/use-mic-test";
import { SURFACE_COPY } from "@/lib/interview/media/use-screen-share-test";
import { useDevicePreviews, type DeviceKind } from "@/lib/interview/media/device-preview-provider";

export type DeviceTestKind = DeviceKind;

const TITLE: Record<DeviceKind, string> = {
  mic: "Microphone test",
  camera: "Camera test",
  screen: "Screen share",
};

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

function Pending({ message }: { message: string }) {
  return <p className="text-sm text-content-subtle">{message}</p>;
}

function Failure({ blocked, message }: { blocked: boolean; message: string | null }) {
  return (
    <StatusStrip tone="danger" badge={blocked ? "Blocked" : "Failed"}>
      {message ?? "Something went wrong."}
    </StatusStrip>
  );
}

function MicPanel() {
  const { mic } = useDevicePreviews();
  const running = mic.status === "running";
  const listening = mic.speechSeconds < REQUIRED_SPEECH_SECONDS;
  const heard = Math.min(1, mic.speechSeconds / REQUIRED_SPEECH_SECONDS);

  return (
    <div className="px-5 py-[22px]">
      <p className="text-base text-content-subtle">
        Say a few words at your normal speaking volume. The microphone stays open, so the reading
        below follows you as you talk.
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
          listening ? (
            <div className="flex flex-col gap-2 rounded-md bg-surface-subtle px-3 py-2.5">
              <span className="text-sm text-content-subtle">
                Listening — keep talking until this fills.
              </span>
              <span className="h-[3px] overflow-hidden rounded-[2px] bg-line-strong">
                <span
                  className="block h-full bg-info transition-[width] duration-200 ease-out"
                  style={{ width: `${heard * 100}%` }}
                />
              </span>
            </div>
          ) : mic.clipping ? (
            <StatusStrip tone="warning" badge="Check">
              Clipping at {mic.peakDb?.toFixed(0)} dB — move back from the mic or lower its input gain
            </StatusStrip>
          ) : (
            <StatusStrip tone="success" badge="Pass">
              Level healthy · peak {mic.peakDb?.toFixed(0)} dB, no clipping
            </StatusStrip>
          )
        ) : mic.status === "requesting" ? (
          <Pending message="Waiting for permission…" />
        ) : (
          <Failure blocked={mic.status === "denied"} message={mic.errorMessage} />
        )}
      </div>
    </div>
  );
}

function CameraPanel() {
  const { camera } = useDevicePreviews();
  const running = camera.status === "running";

  return (
    <div className="px-5 py-[22px]">
      <p className="text-base text-content-subtle">
        Check your framing and lighting. Keep your face inside the guide.
      </p>

      <div className="bg-stripes relative mt-5 flex h-[240px] items-center justify-center overflow-hidden rounded-lg">
        <StreamVideo stream={camera.stream} mirrored />
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
            <Pending message="Checking lighting…" />
          ) : (
            <StatusStrip
              tone={camera.lighting === "good" ? "success" : "warning"}
              badge={camera.lighting === "good" ? "Pass" : "Check"}
            >
              {LIGHTING_COPY[camera.lighting]}
            </StatusStrip>
          )
        ) : camera.status === "requesting" ? (
          <Pending message="Waiting for permission…" />
        ) : (
          <Failure blocked={camera.status === "denied"} message={camera.errorMessage} />
        )}
      </div>
    </div>
  );
}

function ScreenPanel() {
  const { screen } = useDevicePreviews();
  const running = screen.status === "running";
  const partial = screen.surface === "window" || screen.surface === "browser";

  return (
    <div className="px-5 py-[22px]">
      <p className="text-base text-content-subtle">
        Share your whole screen. The integrity terms cover the screen, not one window, so a
        single window is accepted but flagged.
      </p>

      <div className="bg-stripes relative mt-5 flex h-[240px] items-center justify-center overflow-hidden rounded-lg">
        {/* Never mirrored: a flipped screen share is unreadable. */}
        <StreamVideo stream={screen.stream} className="object-contain" />
        {running && screen.resolution && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium">
            {screen.resolution.width}×{screen.resolution.height}
            {screen.frameRate ? ` · ${screen.frameRate} fps` : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {running ? (
          <>
            <StatusStrip tone={partial ? "warning" : "success"} badge={partial ? "Check" : "Pass"}>
              {SURFACE_COPY[screen.surface]}
              {screen.sharingAudio ? " · system audio included" : ""}
            </StatusStrip>
            <p className="text-xs text-content-muted">
              You can stop sharing at any time from your browser&apos;s own sharing bar.
            </p>
          </>
        ) : screen.status === "requesting" ? (
          <Pending message="Pick a screen in your browser's prompt…" />
        ) : screen.status === "ended" ? (
          <StatusStrip tone="warning" badge="Stopped">
            You stopped sharing. Share again before the timed tasks.
          </StatusStrip>
        ) : (
          <Failure blocked={screen.status === "denied"} message={screen.errorMessage} />
        )}
      </div>
    </div>
  );
}

const PANELS: Record<DeviceKind, () => React.ReactElement> = {
  mic: MicPanel,
  camera: CameraPanel,
  screen: ScreenPanel,
};

/** The test and the enlarged preview are the same thing: both show the device
 * that is already open, which is why this owns no acquisition of its own. */
export function DeviceTestDialog({
  kind,
  onClose,
}: {
  kind: DeviceKind | null;
  onClose: () => void;
}) {
  const previews = useDevicePreviews();
  const { restart, stop, active } = previews;
  const Panel = kind ? PANELS[kind] : null;

  const live = kind ? previews[kind].status === "running" : false;
  // Nothing to re-run while a check is live: the device stays open and the
  // reading follows the candidate. The control only earns its place as a way
  // out of a failure -- except for screen share, where picking a different
  // surface is a real thing to want mid-share.
  const showRestart = kind === "screen" || !live;

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="block w-[520px] gap-0 overflow-hidden rounded-xl border-line-strong bg-surface p-0 sm:max-w-[520px]"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <DialogTitle className="flex-1 text-md leading-normal font-medium">
            {kind ? TITLE[kind] : ""}
          </DialogTitle>
          <Button variant="ghost" size="sm" className="text-content-subtle" onClick={onClose}>
            Close
          </Button>
        </div>

        {Panel && <Panel />}

        <div className="flex items-center gap-2.5 border-t border-line bg-surface-subtle px-5 py-3.5">
          {showRestart && (
            <Button variant="secondary" size="sm" onClick={() => kind && restart(kind)}>
              {kind === "screen" ? "Share something else" : "Try again"}
            </Button>
          )}
          {kind && active[kind] && (
            <Button
              variant="ghost"
              size="sm"
              className="text-content-subtle"
              onClick={() => {
                // Releasing on request matters: a candidate who has finished
                // checking should be able to close the camera before the
                // interview rather than sit in front of a live one.
                stop(kind);
                onClose();
              }}
            >
              {kind === "screen" ? "Stop sharing" : "Turn off"}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="primary" size="sm" onClick={onClose}>
            Looks good
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
