"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Eyebrow } from "@/components/ui/typography";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { CodeLanguage, StageId } from "@/lib/interview/types";

/** Jump straight to a round, without sitting the ones before it.
 *
 * The session is created through the browser rather than on the command line, so it
 * belongs to whoever is looking at this page. A session made with `manage.py` belongs to
 * no cookie and reads as "this interview could not be found", which is the friction this
 * page exists to remove.
 *
 * The endpoint behind it is only routed when the backend has DEBUG on, so this page shows
 * what happened rather than pretending to work against a deployment that never mounted it.
 */
const ROUNDS: { stage: StageId; label: string; note: string }[] = [
  { stage: "preflight", label: "Pre-flight", note: "Device checks and consent, from the top" },
  { stage: "resume", label: "Resume review & plan", note: "With seeded resume facts" },
  { stage: "behavioral", label: "Behavioral", note: "With a seeded question" },
  { stage: "coding", label: "Live coding + terminal", note: "Two real tasks from the bank" },
  { stage: "sql", label: "SQL", note: "A real schema and a checked answer" },
  { stage: "wrap", label: "Wrap-up", note: "The closing screen" },
];

const LANGUAGES: CodeLanguage[] = ["python", "java", "c", "cpp"];

export default function DevBypassPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<CodeLanguage>("python");
  const [busy, setBusy] = useState<StageId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jump = async (stage: StageId) => {
    setBusy(stage);
    setError(null);
    try {
      const session = await apiFetch<{ id: string }>("/interview/dev/sessions", {
        method: "POST",
        body: JSON.stringify({ stage, language }),
      });
      router.push(`/interview/${session.id}`);
    } catch (cause) {
      setBusy(null);
      setError(
        cause instanceof ApiError && cause.status === 404
          ? "The bypass is not mounted. It exists only when the backend runs with DEBUG on."
          : cause instanceof ApiError
            ? cause.detail
            : "Could not create a session."
      );
    }
  };

  return (
    <main className="min-h-dvh bg-surface px-6 py-12 text-content">
      <div className="mx-auto max-w-[60ch]">
        <Eyebrow>Development</Eyebrow>
        <h1 className="t-h2 mt-2">Jump to a round</h1>
        <p className="t-body mt-2 leading-[1.7] text-content-subtle">
          Makes a fresh session, seeds what that round needs, and opens it. Consent is
          granted and the plan is marked ready, so the round behaves as it would for a
          candidate who got there the long way.
        </p>

        <Banner tone="warning" className="mt-5">
          <span>
            Seeded content is labelled as seeded. The coding and SQL rounds get real tasks;
            the rest get text that says a person did not write it.
          </span>
        </Banner>

        <div className="mt-7">
          <Eyebrow>Coding language</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === language ? "primary" : "secondary"}
                onClick={() => setLanguage(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2">
          {ROUNDS.map((round) => (
            <button
              key={round.stage}
              type="button"
              disabled={busy !== null}
              onClick={() => jump(round.stage)}
              className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-4 py-3 text-left transition-colors hover:border-line-interactive disabled:opacity-60"
            >
              <span>
                <span className="text-sm font-medium">{round.label}</span>
                <span className="t-xs mt-0.5 block text-content-muted">{round.note}</span>
              </span>
              <span className="t-xs text-content-muted">
                {busy === round.stage ? "opening…" : "open"}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <Banner tone="danger" className="mt-5">
            <span>{error}</span>
          </Banner>
        )}
      </div>
    </main>
  );
}
