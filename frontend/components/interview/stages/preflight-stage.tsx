"use client";

import { useState } from "react";
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
import {
  DevicePreviewProvider,
  useDevicePreviews,
  type DeviceKind,
} from "@/lib/interview/media/device-preview-provider";
import { useScreenShareSupport } from "@/lib/interview/media/use-screen-share-support";
import type { SharedSurface } from "@/lib/interview/media/use-screen-share-test";
import { derivePreflightCta } from "@/lib/interview/selectors";
import { MOCK_RESUME } from "@/lib/interview/mock/session.fixture";
import type { ConsentState } from "@/lib/interview/types";

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
function DeviceCheck({ onOpen }: { onOpen: (kind: DeviceKind) => void }) {
  const { mic, camera, screen, verdicts, start } = useDevicePreviews();
  const support = useScreenShareSupport();

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
        icon={<MicIcon />}
        label="Microphone"
        status={verdicts.mic}
        onTest={testOrOpen("mic", micLive)}
        preview={<MicPreview levels={mic.levels} live={micLive} />}
      />
      <DeviceRow
        icon={<VideoIcon />}
        label="Camera"
        status={verdicts.camera}
        onTest={testOrOpen("camera", camera.status === "running")}
        meta={camera.resolution ? `${camera.resolution.height}p` : undefined}
        preview={<VideoPreview stream={camera.stream} mirrored placeholder="camera off" />}
      />
      <DeviceRow
        icon={<MonitorIcon />}
        label="Screen share"
        status={support.supported ? verdicts.screen : "fail"}
        // The candidate is asked, not probed: getDisplayMedia always shows the
        // browser's own picker and must come from a gesture.
        onTest={support.supported ? testOrOpen("screen", screen.status === "running") : undefined}
        testLabel="Share your screen"
        // Once sharing, what was shared matters more than how many displays
        // exist -- a single window is a weaker assurance than a whole screen.
        meta={screen.status === "running" ? SHARED_SURFACE_META[screen.surface] : support.meta}
        preview={<VideoPreview stream={screen.stream} placeholder="not shared" />}
        isLast
      />
    </div>
  );
}

function PreflightBody() {
  const { session, dispatch } = useInterviewSession();
  const [open, setOpen] = useState<DeviceKind | null>(null);

  const cta = derivePreflightCta(session);

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
          <DeviceCheck onOpen={setOpen} />
        </Card>

        <Card className="mt-6 p-4">
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

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Button
            variant="primary"
            className="w-full"
            disabled={cta.disabled}
            onClick={() => dispatch({ type: "ADVANCE" })}
          >
            {cta.label}
          </Button>
          <span className="text-center text-xs text-content-muted">{cta.hint}</span>
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
