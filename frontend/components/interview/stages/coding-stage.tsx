"use client";

import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Mono } from "@/components/ui/typography";
import { CodeSurface } from "@/components/ui/code-surface";
import { TaskBriefPanel } from "@/components/interview/organisms/task-brief-panel";
import { TestCasePanel } from "@/components/interview/organisms/test-case-panel";
import { TerminalPanel } from "@/components/interview/organisms/terminal-panel";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useCodingRound } from "@/lib/interview/use-coding-round";
import type { CodeLanguage } from "@/lib/interview/types";
import { MissingRoundContent } from "./missing-round-content";

const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  sql: "SQL",
};

const LANGUAGE_CHIP: Record<CodeLanguage, string> = {
  python: "py",
  java: "java",
  c: "c",
  cpp: "cpp",
  sql: "sql",
};

const OFFERED: CodeLanguage[] = ["python", "java", "c", "cpp"];

export function CodingStage() {
  const { session, dispatch } = useInterviewSession();
  const content = session.content.coding;

  if (!content || content.tasks.length === 0) return <MissingRoundContent />;
  return <CodingRound sessionId={session.id} content={content} onFinish={() => dispatch({ type: "ADVANCE" })} />;
}

function CodingRound({
  sessionId,
  content,
  onFinish,
}: {
  sessionId: string;
  content: NonNullable<ReturnType<typeof useInterviewSession>["session"]["content"]["coding"]>;
  onFinish: () => void;
}) {
  const round = useCodingRound({
    sessionId,
    tasks: content.tasks,
    defaultLanguage: content.defaultLanguage,
    onFinish,
  });
  const [activeFile, setActiveFile] = useState(0);

  const file = round.files[Math.min(activeFile, Math.max(round.files.length - 1, 0))];
  const preparing = round.languageState === "preparing";

  return (
    <div className="flex min-h-0 flex-1">
      <TaskBriefPanel task={round.task} attempts={round.attempts} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-surface">
          {round.files.map((candidate, index) => (
            <button
              key={candidate.name}
              type="button"
              onClick={() => setActiveFile(index)}
              data-active={index === activeFile}
              className="flex items-center gap-2 border-r border-line px-3.5 text-xs text-content-muted data-[active=true]:bg-surface-subtle data-[active=true]:font-medium data-[active=true]:text-content"
            >
              <Mono className="text-2xs text-info">{LANGUAGE_CHIP[candidate.language]}</Mono>
              {candidate.name}
            </button>
          ))}

          <div className="flex-1" />

          <div className="flex items-center gap-2 px-3">
            <Segmented
              value={round.language}
              onValueChange={(next) => next && round.selectLanguage(next as CodeLanguage)}
            >
              {OFFERED.map((option) => (
                <SegmentedItem key={option} value={option} disabled={round.running}>
                  {LANGUAGE_LABEL[option]}
                  {preparing && option === round.language ? " …" : ""}
                </SegmentedItem>
              ))}
            </Segmented>
            <Button
              variant="secondary"
              size="sm"
              disabled={!round.canRun}
              onClick={round.runTests}
              title={runTitle(round.running, preparing, round.attempts)}
            >
              {round.running ? "Running…" : "Run tests"}
            </Button>
            {/* Disabled during a run: advancing past an attempt that is still being
                written records it against a task the candidate has already left. */}
            <Button variant="primary" size="sm" disabled={round.running} onClick={round.submit}>
              {round.isLastTask ? "Submit" : "Next task"}
            </Button>
          </div>
        </div>

        <Group orientation="vertical" className="min-h-0 flex-1">
          <Panel defaultSize="62%" minSize="25%" className="flex min-h-0 flex-col">
            {preparing ? (
              <Placeholder>Preparing {LANGUAGE_LABEL[round.language]}…</Placeholder>
            ) : round.languageState === "failed" ? (
              <Placeholder>
                We couldn&rsquo;t prepare {LANGUAGE_LABEL[round.language]}. Pick another language.
              </Placeholder>
            ) : file ? (
              <CodeSurface
                key={`${round.taskIndex}:${round.language}:${file.name}`}
                value={round.contentOf(file.name)}
                language={file.language}
                readOnly={file.readOnly}
                onChange={(next) => round.edit(file.name, next)}
              />
            ) : (
              <Placeholder>No files for this task yet.</Placeholder>
            )}
          </Panel>

          <Separator className="h-px shrink-0 bg-line transition-colors hover:bg-line-interactive" />

          <Panel defaultSize="38%" minSize="15%" className="flex min-h-0">
            <TerminalPanel
              title="Terminal"
              subtitle={round.running ? "running" : undefined}
              lines={round.terminal}
              exitCode={round.exitCode}
              className="min-w-0 flex-1"
              footer={round.result ? <RunNote result={round.result} /> : undefined}
            />
            <TestCasePanel task={round.task} tests={round.tests} />
          </Panel>
        </Group>
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-xs text-content-muted">
      {children}
    </div>
  );
}

/** What happened, when what happened was not "the tests ran".
 *
 * A compile failure is not a set of failing tests, and a run that never reached the
 * sandbox is not a verdict on the candidate at all. */
function RunNote({ result }: { result: { phase: string; detail?: string; timedOut: boolean; truncated: boolean } }) {
  const note = NOTE[result.phase];
  if (!note && !result.truncated) return null;
  return (
    <div className="border-t border-[hsl(0_0%_100%/0.1)] px-3 py-2 text-2xs text-[hsl(38_5%_71%)]">
      {result.detail ?? note}
      {result.truncated && " Output was truncated."}
    </div>
  );
}

const NOTE: Record<string, string> = {
  compile_failed: "That didn't build, so no tests ran — and this attempt wasn't counted.",
  crashed: "The test process stopped early. Cases after that point never ran.",
  timeout: "This run hit its time limit and was stopped.",
  unavailable: "The code runner is unavailable, so this attempt wasn't counted.",
};

function runTitle(
  running: boolean,
  preparing: boolean,
  attempts: { attemptsUsed: number; attemptsAllowed: number }
): string | undefined {
  if (running) return "A run is already going";
  if (preparing) return "Still preparing this language";
  if (attempts.attemptsUsed >= attempts.attemptsAllowed) return "No attempts left for this task";
  return undefined;
}
