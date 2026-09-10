"use client";

import { Banner } from "@/components/ui/banner";
import { ResumeReviewPanel } from "@/components/interview/organisms/resume-review-panel";
import { GeneratedPlanPanel } from "@/components/interview/organisms/generated-plan-panel";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { CitationProvider } from "@/lib/interview/citation-context";

export function ResumePlanStage() {
  const { session } = useInterviewSession();

  // Reachable only by advancing past pre-flight, which requires a resume --
  // but the type is nullable, so say something useful rather than crash.
  if (!session.resume) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-10">
        <Banner tone="warning" className="max-w-[46ch]">
          <span>No resume is attached to this session, so there is no plan to review.</span>
        </Banner>
      </div>
    );
  }

  return (
    <CitationProvider>
      <div className="flex min-h-0 flex-1">
        <ResumeReviewPanel resume={session.resume} rounds={session.rounds} />
        <GeneratedPlanPanel />
      </div>
    </CitationProvider>
  );
}
