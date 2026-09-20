import { Banner } from "@/components/ui/banner";
import type { ContentState, InterviewSession, StageId } from "@/lib/interview/types";

/** What the server has to say about a round with nothing on screen.
 *
 * Read off the round rather than inferred from the content being absent. Three
 * situations look identical from the outside and the candidate is owed the
 * difference: something is being written for them right now, something was attempted
 * and failed, or nothing is coming at all. */
export function contentStateOf(session: InterviewSession, stage: StageId): ContentState {
  const round = session.rounds.find((r) => r.id === stage);
  if (round?.contentState === "generating" || round?.contentState === "pending") {
    return "generating";
  }
  return round?.contentState === "failed" ? "failed" : "ready";
}

/** Shown when a round's screen exists but the server sent no content for it. */
export function MissingRoundContent({
  state = "ready",
  /** Whether this round's material is run in the sandbox before it is handed over.
   * The coding and SQL tasks are, and that is most of why they take a while; a
   * conversation round is written and done, so promising the same check would be
   * describing work nobody does. */
  checkedByRunning = false,
}: {
  /** "generating" while the server is writing it, "failed" once it gave up. "ready"
   * here means the round simply has no generator -- nothing was attempted. */
  state?: ContentState;
  checkedByRunning?: boolean;
}) {
  const generating = state === "generating";

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-10">
      <Banner tone={generating ? "info" : state === "failed" ? "danger" : "warning"} className="max-w-[52ch]">
        <span>
          {generating
            ? checkedByRunning
              ? "Writing this round from your resume. It is generated and then run to check it can be solved, which takes a moment — this screen updates when it is ready."
              : "Writing this round from your resume. This screen updates when it is ready."
            : state === "failed"
              ? // Said plainly, because the alternative is the sentence below: a promise
                // that this round is still coming, made about one that is not.
                "This round could not be prepared, and it is not going to arrive. Nothing you did caused it. Move on to the next round — this one is not counted against you."
              : "This round has no material attached yet. The interviewer will generate it before it starts."}
        </span>
      </Banner>
    </div>
  );
}
