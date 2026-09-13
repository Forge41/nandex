"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { CodeSurface } from "@/components/ui/code-surface";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useCodingRound } from "@/lib/interview/use-coding-round";
import { testLabel, testSummary } from "@/lib/interview/coding";
import type { SqlResult, SqlTask } from "@/lib/interview/types";
import { MissingRoundContent, isGenerating } from "./missing-round-content";

const QUERY_FILE = "query.sql";

export function SqlStage() {
  const { session, dispatch } = useInterviewSession();
  const content = session.content.sql;
  const roundNumber = session.rounds.findIndex((r) => r.id === "sql") + 1;

  if (!content || content.tasks.length === 0) {
    return <MissingRoundContent generating={isGenerating(session, "sql")} />;
  }
  return (
    <SqlRound
      sessionId={session.id}
      tasks={content.tasks}
      roundNumber={roundNumber}
      onFinish={() => dispatch({ type: "ADVANCE" })}
    />
  );
}

function SqlRound({
  sessionId,
  tasks,
  roundNumber,
  onFinish,
}: {
  sessionId: string;
  tasks: SqlTask[];
  roundNumber: number;
  onFinish: () => void;
}) {
  const round = useCodingRound({
    sessionId,
    stage: "sql",
    tasks,
    defaultLanguage: "sql",
    onFinish,
  });
  const task = round.task;
  const summary = testSummary(round.tests);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="scrollbar-thin w-[236px] shrink-0 overflow-y-auto border-r border-line bg-surface-subtle px-3.5 py-4">
        <Eyebrow>Schema</Eyebrow>
        <div className="mt-3 flex flex-col gap-3.5">
          {task.schema.map((table) => (
            <div key={table.name}>
              <Mono className="text-xs font-semibold">{table.name}</Mono>
              <div className="mt-1 flex flex-col">
                {table.columns.map((column) => (
                  <Mono key={column.name} className="text-2xs leading-[1.9] text-content-subtle">
                    {column.name} · {column.type}
                  </Mono>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-3.5">
          <Eyebrow>Checks</Eyebrow>
          <div className="mt-2 flex flex-col gap-1.5">
            {round.tests.map((test) => (
              <div key={test.name} className="flex items-center justify-between text-2xs">
                <span className="text-content-subtle">{test.name}</span>
                <Mono
                  className={
                    test.outcome === "fail"
                      ? "text-danger"
                      : test.outcome === "pass"
                        ? "text-success"
                        : "text-content-muted"
                  }
                >
                  {testLabel(test)}
                </Mono>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-2xs">
            <span className="text-content-subtle">Attempts</span>
            <Mono>
              {round.attempts.attemptsUsed} / {round.attempts.attemptsAllowed}
            </Mono>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line px-5.5 py-4">
          <Eyebrow>
            Round {roundNumber} · SQL
          </Eyebrow>
          <p className="t-body mt-1.5 max-w-[78ch]">{task.prompt}</p>
        </div>

        <div className="shrink-0 border-b border-line px-5.5 py-3.5">
          <div className="overflow-hidden rounded-sm border border-line">
            <CodeSurface
              key={`${round.taskIndex}:${QUERY_FILE}`}
              value={round.contentOf(QUERY_FILE)}
              language="sql"
              onChange={(next) => round.edit(QUERY_FILE, next)}
              className="max-h-[220px]"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!round.canRun}
              onClick={round.runTests}
              title={
                round.attempts.attemptsUsed >= round.attempts.attemptsAllowed
                  ? "No attempts left"
                  : undefined
              }
            >
              {round.running ? "Running…" : "Run query"}
            </Button>
            <Button variant="primary" size="sm" disabled={round.running} onClick={round.submit}>
              Submit answer
            </Button>
            {round.result?.durationMs ? (
              <Mono className="text-2xs text-content-muted">{round.result.durationMs} ms</Mono>
            ) : null}
            <span className="text-2xs text-content-muted">{summary.label}</span>
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
          {round.rows ? (
            <ResultGrid result={round.rows} />
          ) : (
            <p className="px-5.5 py-6 text-xs text-content-muted">
              {round.running
                ? "Running your query…"
                : "Run your query to see its result."}
            </p>
          )}

          {round.result && round.result.phase !== "ran" && (
            <Banner tone="warning" className="mx-5.5 my-3.5">
              <span>{round.result.detail ?? SQL_NOTE[round.result.phase]}</span>
            </Banner>
          )}
        </div>
      </div>
    </div>
  );
}

/** The rows Postgres actually returned. Never a fixture: a result grid the candidate
 * did not produce is a claim about a query nobody ran. */
function ResultGrid({ result }: { result: SqlResult }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-surface-subtle">
          {result.columns.map((column, index) => (
            <th
              key={column}
              className={`border-b border-line-strong px-3.5 py-2 font-medium text-content-subtle ${
                result.numericColumns.includes(index) ? "text-right" : "text-left"
              }`}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="t-mono">
        {result.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={`border-b border-line px-3.5 py-[7px] ${
                  result.numericColumns.includes(cellIndex) ? "text-right" : ""
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SQL_NOTE: Record<string, string> = {
  compile_failed: "The schema could not be set up, so nothing ran — and no attempt was used.",
  crashed: "That query did not run to completion.",
  timeout: "That query hit its time limit and was stopped.",
  unavailable: "The query runner is unavailable, so this attempt wasn't counted.",
};
