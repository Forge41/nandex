import Link from "next/link";
import { Banner } from "@/components/ui/banner";
import { Eyebrow } from "@/components/ui/typography";

/** Two harnesses, for two different questions.
 *
 * Keeping them apart is the point of this page. Asking "what does this screen look
 * like" through a real session means a workflow, model calls and a runner, and every
 * error those produce is noise against the question actually being asked. */
const HARNESSES = [
  {
    href: "/dev/screens",
    label: "Screens",
    question: "What does this screen look like?",
    detail:
      "Every screen including the rounds that do not ship, rendered from fixtures, with the network cut. No backend needs to be running.",
  },
  {
    href: "/dev/session",
    label: "Seeded session",
    question: "Does the pipeline work?",
    detail:
      "Creates a real session and jumps to a round: real workflow, real tasks, real runner. Needs the backend, and behaves like one.",
  },
];

export default function DevIndexPage() {
  return (
    <main className="min-h-dvh bg-surface px-6 py-12 text-content">
      <div className="mx-auto max-w-[60ch]">
        <Eyebrow>Development</Eyebrow>
        <h1 className="t-h2 mt-2">Harnesses</h1>

        <div className="mt-7 flex flex-col gap-2">
          {HARNESSES.map((harness) => (
            <Link
              key={harness.href}
              href={harness.href}
              className="rounded-md border border-line bg-surface-subtle px-4 py-3.5 transition-colors hover:border-line-interactive"
            >
              <span className="text-sm font-medium">{harness.label}</span>
              <span className="t-small mt-0.5 block text-content-subtle">
                {harness.question}
              </span>
              <span className="t-xs mt-1.5 block text-content-muted">{harness.detail}</span>
            </Link>
          ))}
        </div>

        <Banner tone="warning" className="mt-6">
          <span>
            Neither proves the other. A screen rendered from fixtures says nothing about
            generation, the workflow, the runner or the agent.
          </span>
        </Banner>
      </div>
    </main>
  );
}
