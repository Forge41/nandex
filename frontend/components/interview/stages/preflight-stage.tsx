"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AudioBars } from "@/components/ui/audio-bars";
import { Eyebrow } from "@/components/ui/typography";
import { MicIcon, VideoIcon, MonitorIcon } from "@/components/interview/icons";
import { DeviceRow } from "@/components/interview/molecules/device-row";
import { ResumeDropzone } from "@/components/interview/molecules/resume-dropzone";
import { ResumeInspector } from "@/components/interview/organisms/resume-inspector";
import { DeviceTestDialog, type DeviceTestKind } from "@/components/interview/organisms/device-test-dialog";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useScreenShareSupport } from "@/lib/interview/media/use-screen-share-support";
import { derivePreflightCta } from "@/lib/interview/selectors";
import { MOCK_RESUME } from "@/lib/interview/mock/session.fixture";
import type { ConsentState, DeviceStatus } from "@/lib/interview/types";

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

/** Flat bars: an idle affordance, not a live reading. Real levels only appear
 * inside the test, where the microphone is actually open. */
function IdleMicPreview() {
  return (
    <span className="flex h-9 w-[62px] shrink-0 items-center rounded-sm bg-surface-subtle px-1.5 py-[9px]">
      <AudioBars barWidth={3} gap={4} className="h-full w-full" levels={[0.08, 0.08, 0.08, 0.08, 0.08]} />
    </span>
  );
}

function CameraThumbPreview() {
  return (
    <span className="bg-stripes relative flex h-9 w-[62px] shrink-0 items-end justify-center overflow-hidden rounded-sm">
      <span className="h-[22px] w-[26px] rounded-t-[13px] bg-content-muted opacity-50" />
      <span className="absolute top-[5px] left-1/2 size-[13px] -translate-x-1/2 rounded-full bg-content-muted opacity-50" />
    </span>
  );
}

export function PreflightStage() {
  const { session, dispatch } = useInterviewSession();
  const screen = useScreenShareSupport();
  const [testing, setTesting] = useState<DeviceTestKind | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<Record<DeviceTestKind, DeviceStatus>>({
    mic: "untested",
    camera: "untested",
  });

  const recordVerdict = useCallback((kind: DeviceTestKind, status: DeviceStatus) => {
    setDeviceStatus((current) => (current[kind] === status ? current : { ...current, [kind]: status }));
  }, []);

  const cta = derivePreflightCta(session);

  // The parse itself is still mocked; the file the candidate actually chose
  // supplies its own name and size so the card never misreports what was read.
  const acceptResume = (file: File) =>
    dispatch({ type: "SET_RESUME", resume: { ...MOCK_RESUME, fileName: file.name, sizeBytes: file.size } });

  return (
    <div className="flex min-h-0 flex-1 gap-[22px] px-[26px] py-[22px]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 flex-1 flex-col p-4">
          {session.resume ? (
            <ResumeInspector resume={session.resume} onReplace={() => dispatch({ type: "CLEAR_RESUME" })} />
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
          <div className="mt-3 flex flex-col">
            <DeviceRow
              icon={<MicIcon />}
              label="Microphone"
              status={deviceStatus.mic}
              onTest={() => setTesting("mic")}
              preview={<IdleMicPreview />}
            />
            <DeviceRow
              icon={<VideoIcon />}
              label="Camera"
              status={deviceStatus.camera}
              onTest={() => setTesting("camera")}
              preview={<CameraThumbPreview />}
            />
            <DeviceRow
              icon={<MonitorIcon />}
              label="Screen share"
              status={screen.status}
              meta={screen.meta}
              isLast
            />
          </div>
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

      <DeviceTestDialog kind={testing} onClose={() => setTesting(null)} onVerdict={recordVerdict} />
    </div>
  );
}
