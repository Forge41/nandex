"use client";

import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { Eyebrow } from "@/components/ui/typography";
import { RoundHeader } from "@/components/interview/molecules/round-header";
import { TranscriptTurn } from "@/components/interview/molecules/transcript-turn";
import { CitationChip } from "@/components/interview/molecules/citation-chip";
import { CaptionOverlay } from "@/components/interview/organisms/caption-overlay";
import { ConnectionBanner } from "@/components/interview/organisms/connection-banner";
import { CitationProvider } from "@/lib/interview/citation-context";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useTranscript } from "@/lib/interview/transcript-provider";
import { initialsOf } from "@/lib/interview/format";
import { MissingRoundContent } from "./missing-round-content";

export function BehavioralStage() {
  const { session } = useInterviewSession();
  const turns = useTranscript();
  const content = session.content.behavioral;
  const round = session.rounds.find((r) => r.id === "behavioral");
  const roundNumber = session.rounds.findIndex((r) => r.id === "behavioral") + 1;

  if (!content) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConnectionBanner />
        <MissingRoundContent />
      </div>
    );
  }

  return (
    <CitationProvider>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConnectionBanner />
        <RoundHeader
          eyebrow={`Round ${roundNumber} · ${round?.label ?? "Behavioral"}`}
          eyebrowAside={
            <Badge tone="neutral" size="sm">
              question {content.questionNumber} of {content.questionTotal}
            </Badge>
          }
          prompt={content.question}
          serif
          className="px-7 pt-5 pb-4"
        >
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Eyebrow className="mr-0.5">Derived from</Eyebrow>
            {content.derivedFrom.map((source, index) => (
              <Tag key={source} variant="outline">
                {source}
                {index === 0 && content.citation !== undefined && <CitationChip n={content.citation} />}
              </Tag>
            ))}
          </div>
        </RoundHeader>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-7 py-4">
          <Eyebrow>Transcript</Eyebrow>
          <div className="mt-3.5 flex flex-col gap-4">
            {turns.map((turn) => (
              <TranscriptTurn
                key={turn.id}
                turn={turn}
                variant="full"
                candidateInitials={initialsOf(session.candidateName)}
              />
            ))}
          </div>
        </div>

        <CaptionOverlay />
      </div>
    </CitationProvider>
  );
}
