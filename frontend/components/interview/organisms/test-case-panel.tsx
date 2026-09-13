import { Badge } from "@/components/ui/badge";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { StatusDot } from "@/components/ui/indicators";
import { testDot, testLabel, testSummary } from "@/lib/interview/coding";
import type { CodingTask, TestCase } from "@/lib/interview/types";

const SUMMARY_TONE = {
  "not-run": "neutral",
  failing: "danger",
  passing: "success",
} as const;

export function TestCasePanel({ task, tests }: { task: CodingTask; tests: TestCase[] }) {
  const summary = testSummary(tests);

  return (
    <div className="scrollbar-thin w-[288px] shrink-0 overflow-y-auto border-l border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Eyebrow>Test cases</Eyebrow>
        <Badge tone={SUMMARY_TONE[summary.state]} size="sm">
          {summary.label}
        </Badge>
      </div>

      <div className="flex flex-col">
        {tests.map((test) => {
          const isFail = !test.hidden && test.outcome === "fail";
          const isMuted = test.hidden || test.outcome === undefined;

          return (
            <div
              key={test.name}
              className={`flex items-center gap-2 border-b border-line px-3 py-[7px] ${isFail ? "bg-danger-bg" : ""}`}
            >
              <StatusDot tone={testDot(test)} />
              <Mono
                className={`min-w-0 flex-1 truncate text-2xs ${
                  isFail ? "text-danger" : isMuted ? "text-content-muted" : ""
                }`}
              >
                {test.name}
              </Mono>
              <Mono className={`text-[10px] ${isFail ? "text-danger" : "text-content-muted"}`}>
                {testLabel(test)}
              </Mono>
            </div>
          );
        })}
      </div>

      {task.complexity.length > 0 && (
        <div className="border-b border-line px-3 py-2.5">
          <Eyebrow>Complexity target</Eyebrow>
          <div className="mt-2 flex flex-col gap-[5px]">
            {task.complexity.map((row) => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-content-subtle">{row.label}</span>
                <Mono className={row.tone === "warning" ? "text-warning" : undefined}>
                  {row.value}
                </Mono>
              </div>
            ))}
          </div>
          {task.complexityNote && (
            <p className="t-xs mt-2 leading-[1.5] text-content-muted">{task.complexityNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
