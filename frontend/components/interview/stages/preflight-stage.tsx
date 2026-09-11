"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Eyebrow } from "@/components/ui/typography";
import { MicIcon, VideoIcon, MonitorIcon } from "@/components/interview/icons";
import { DeviceRow } from "@/components/interview/molecules/device-row";
import { MicPreview, VideoPreview } from "@/components/interview/molecules/device-preview";
import { ResumeDropzone } from "@/components/interview/molecules/resume-dropzone";
import { ResumeInspector } from "@/components/interview/organisms/resume-inspector";
import { DeviceTestDialog } from "@/components/interview/organisms/device-test-dialog";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { DevicePreviewProvider, useDevicePreviews } from "@/lib/interview/media/device-preview-provider";
import { useScreenShareSupport } from "@/lib/interview/media/use-screen-share-support";
import type { SharedSurface } from "@/lib/interview/media/use-screen-share-test";
import { deriveDeviceGate, derivePreflightCta } from "@/lib/interview/selectors";
import { MOCK_RESUME } from "@/lib/interview/mock/session.fixture";
import type { ConsentState, DeviceKind } from "@/lib/interview/types";

const CONSENT_TERMS: { key: keyof ConsentState; label: string }[] = [
  {
    key: "recording",
    label: "This session is recorded — audio, transcript, and code — and reviewed by a human before any decision.",
  },
  { key: "aiInterviewer", label: "My interviewer is an AI agent. I can request a human interviewer at any point." },
  {
    key: "integrityMonitoring",
    label: "Integrity monitoring is active during timed tasks (camera, screen, paste events).",
  },
];

const SHARED_SURFACE_META: Record<SharedSurface, string> = {
  monitor: "whole screen",
  window: "one window",
  browser: "one tab",
  unknown: "sharing",
};

/** The device check.
 *
 * Every preview here is the device itself. The previous drawn stand-ins -- flat
 * bars and a sketched figure -- looked like readings while measuring nothing,
 * which in a check that exists to answer "does my camera work" is the one thing
 * it must not do.
 *
 * The whole row is the control, preview included: opening the check and
 * enlarging the preview are the same thing -- a closer look at a device that is
 * already open. */
function DeviceCheck({
  onOpen,
  flagged,
  firstFlaggedRef,
}: {
  onOpen: (kind: DeviceKind) => void;
  flagged: readonly DeviceKind[];
  firstFlaggedRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { mic, camera, screen, verdicts, start } = useDevicePreviews();
  const support = useScreenShareSupport();
  // Only the first gets the ref: focus goes to one row, and it should be the
  // one nearest the top rather than whichever rendered last.
  const flaggedFirst = flagged[0];

  const micLive = mic.status === "running";
  const testOrOpen = (kind: DeviceKind, live: boolean) => () => {
    if (live) onOpen(kind);
    else {
      start(kind);
      onOpen(kind);
    }
  };

  return (
    <div className="mt-3 flex flex-col">
      <DeviceRow
        ref={flaggedFirst === "mic" ? firstFlaggedRef : undefined}
        icon={<MicIcon />}
        label="Microphone"
        status={verdicts.mic}
        flagged={flagged.includes("mic")}
        onTest={testOrOpen("mic", micLive)}
        preview={<MicPreview levels={mic.levels} live={micLive} />}
      />
      <DeviceRow
        ref={flaggedFirst === "camera" ? firstFlaggedRef : undefined}
        icon={<VideoIcon />}
        label="Camera"
        status={verdicts.camera}
        flagged={flagged.includes("camera")}
        onTest={testOrOpen("camera", camera.status === "running")}
        meta={camera.resolution ? `${camera.resolution.height}p` : undefined}
        preview={<VideoPreview stream={camera.stream} mirrored placeholder="camera off" />}
      />
      <DeviceRow
        ref={flaggedFirst === "screen" ? firstFlaggedRef : undefined}
        icon={<MonitorIcon />}
        label="Screen share"
        status={support.supported ? verdicts.screen : "fail"}
        flagged={flagged.includes("screen")}
        // The candidate is asked, not probed: getDisplayMedia always shows the
        // browser's own picker and must come from a gesture.
        onTest={support.supported ? testOrOpen("screen", screen.status === "running") : undefined}
        testLabel="Share your screen"
        // Only what was actually shared, and only once it has been: a single
        // window is a weaker assurance than a whole screen, which is worth
        // saying. How many displays the machine has is not.
        meta={
          !support.supported
            ? "unsupported"
            : screen.status === "running"
              ? SHARED_SURFACE_META[screen.surface]
              : undefined
        }
        preview={<VideoPreview stream={screen.stream} placeholder="not shared" />}
        isLast
      />
    </div>
  );
}

function PreflightBody() {
  const { session, dispatch } = useInterviewSession();
  const { tested } = useDevicePreviews();
  const support = useScreenShareSupport();
  const [open, setOpen] = useState<DeviceKind | null>(null);
  // Set only by a click on the CTA -- the candidate is told what is missing at
  // the moment they try, rather than being warned about it from the start.
  const [flagged, setFlagged] = useState<readonly DeviceKind[]>([]);
  const firstFlaggedRef = useRef<HTMLButtonElement | null>(null);

  const cta = derivePreflightCta(session);
  const gate = deriveDeviceGate(tested, { screenSupported: support.supported });

  // A flag cannot outlive the thing it was flagging, so it is intersected with
  // what is still untested on every render rather than cleared by an effect.
  // The stored set may hold stale kinds; nothing reads it unintersected, and a
  // later click replaces it wholesale.
  const stillFlagged = flagged.filter((kind) => gate.untested.includes(kind));

  const attemptAdvance = () => {
    if (!gate.ready) {
      setFlagged(gate.untested);
      // The row is one button covering its whole width, so focusing it puts the
      // fix one keystroke away instead of somewhere up the page.
      requestAnimationFrame(() => firstFlaggedRef.current?.focus());
      return;
    }
    dispatch({ type: "ADVANCE" });
  };

  // The extracted content is still mocked; the file the candidate actually
  // chose supplies its name, size and preview so nothing on screen misreports
  // what was read. Object URLs are revoked on replace rather than accumulating.
  const acceptResume = (file: File) => {
    if (session.resume?.previewUrl) URL.revokeObjectURL(session.resume.previewUrl);
    dispatch({
      type: "SET_RESUME",
      resume: {
        // Extracted content (sections, probes, citations) is fixture; the file
        // facts are the real ones; the page count is dropped because nothing
        // here has actually read the document.
        ...MOCK_RESUME,
        fileName: file.name,
        sizeBytes: file.size,
        pageCount: undefined,
        previewUrl: URL.createObjectURL(file),
        previewType: file.type,
      },
    });
  };

  const clearResume = () => {
    if (session.resume?.previewUrl) URL.revokeObjectURL(session.resume.previewUrl);
    dispatch({ type: "CLEAR_RESUME" });
  };

  return (
    <div className="flex min-h-0 flex-1 gap-[22px] px-[26px] py-[22px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 flex-1 flex-col p-4">
          {session.resume ? (
            <ResumeInspector resume={session.resume} onReplace={clearResume} />
          ) : (
            <ResumeDropzone onFile={acceptResume} />
          )}
        </Card>
      </div>

      <div className="scrollbar-thin flex w-[392px] shrink-0 flex-col gap-3.5 overflow-y-auto">
        <div>
          <Eyebrow>Step 1 of 3</Eyebrow>
          <h1 className="t-title mt-2 text-2xl">Before we begin</h1>
          <p className="t-small mt-2 text-content-subtle">{cta.subtitle}</p>
        </div>

        <Card className="p-4">
          <Eyebrow>Device &amp; environment check</Eyebrow>
          <DeviceCheck onOpen={setOpen} flagged={stillFlagged} firstFlaggedRef={firstFlaggedRef} />
        </Card>

        {/* Consent and the button that acts on it are one group, pinned to the
            bottom together: agreeing and proceeding are one step, and leaving
            the button to drift down alone opened a dead gap between them. */}
        <div className="mt-auto flex flex-col gap-3.5 pt-6">
          <Card className="p-4">
            <Eyebrow>Consent</Eyebrow>
            <div className="mt-3 flex flex-col gap-2.5">
              {CONSENT_TERMS.map((term) => (
                <label key={term.key} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox
                    className="mt-px"
                    checked={session.consent[term.key]}
                    onCheckedChange={() => dispatch({ type: "TOGGLE_CONSENT", key: term.key })}
                  />
                  <span>{term.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              className="w-full"
              disabled={cta.disabled}
              onClick={attemptAdvance}
            >
              {cta.label}
            </Button>
            {stillFlagged.length > 0 ? (
              // role="alert" so it is announced: a candidate who clicked and saw
              // nothing happen needs telling, not just showing.
              <span role="alert" className="text-center text-xs text-warning">
                {gate.message}
              </span>
            ) : (
              <span className="text-center text-xs text-content-muted">{cta.hint}</span>
            )}
          </div>
        </div>
      </div>

      <DeviceTestDialog kind={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** The provider wraps the stage rather than living inside the card, so the
 * devices are released exactly when the pre-flight leaves the screen -- the
 * room acquires its own tracks, and two claims on one camera is how a black
 * self-view happens. */
export function PreflightStage() {
  return (
    <DevicePreviewProvider>
      <PreflightBody />
    </DevicePreviewProvider>
  );
}
