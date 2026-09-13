import { Banner } from "@/components/ui/banner";
import type { InterviewSession, StageId } from "@/lib/interview/types";

/** Whether the server is writing this round right now.
 *
 * Read off the round rather than assumed from the content being absent: a stage with
 * no generator is also absent, and telling that candidate to wait would be a promise
 * nothing is going to keep. */
export function isGenerating(session: InterviewSession, stage: StageId): boolean {
  const round = session.rounds.find((r) => r.id === stage);
  return round?.contentState === "generating" || round?.contentState === "pending";
}

/** Shown when a round's screen exists but the server sent no content for it.
 *
 * Two different situations, and the candidate is owed the difference: something is
 * being written for them right now, or nothing is. The same sentence for both leaves
 * someone watching a static banner with no idea whether to wait. */
export function MissingRoundContent({ generating = false }: { generating?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-10">
      <Banner tone={generating ? "info" : "warning"} className="max-w-[52ch]">
        <span>
          {generating
            ? "Writing this round from your resume. It is generated and then run to check it can be solved, which takes a few minutes — this screen updates when it is ready."
            : "This round has no material attached yet. The interviewer will generate it before it starts."}
        </span>
      </Banner>
    </div>
  );
}
