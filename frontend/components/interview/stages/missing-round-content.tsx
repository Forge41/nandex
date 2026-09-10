import { Banner } from "@/components/ui/banner";

/** Shown when a round's screen exists but the server sent no content for it.
 * Distinct from the placeholder for rounds that aren't built yet: this one
 * means the round is real and its material is missing. */
export function MissingRoundContent() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-10">
      <Banner tone="warning" className="max-w-[46ch]">
        <span>This round has no material attached yet. The interviewer will generate it before it starts.</span>
      </Banner>
    </div>
  );
}
