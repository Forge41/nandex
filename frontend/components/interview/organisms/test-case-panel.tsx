import { Badge } from "@/components/ui/badge";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { StatusDot } from "@/components/ui/indicators";
import type { CodingTask, TestCase } from "@/lib/interview/types";

const OUTCOME = {
  pass: { tone: "success", label: (test: TestCase) => `${test.durationMs}ms` },
  fail: { tone: "danger", label: () => "fail" },
  hidden: { tone: "disabled", label: () => "hidden" },
} as const;

export function TestCasePanel({ task }: { task: CodingTask }) {
  const failing = task.tests.filter((test) => test.outcome === "fail").length;

  return (
    <div className="scrollbar-thin w-[288px] shrink-0 overflow-y-auto border-l border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Eyebrow>Test cases</Eyebrow>
        {failing > 0 ? (
          <Badge tone="danger" size="sm">
            {failing} failing
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            all passing
          </Badge>
        )}
      </div>

      <div className="flex flex-col">
        {task.tests.map((test) => {
          const outcome = OUTCOME[test.outcome];
          const isFail = test.outcome === "fail";

          return (
            <div
              key={test.name}
              className={`flex items-center gap-2 border-b border-line px-3 py-[7px] ${isFail ? "bg-danger-bg" : ""}`}
            >
              <StatusDot tone={outcome.tone} />
              <Mono
                className={`min-w-0 flex-1 truncate text-2xs ${
                  isFail ? "text-danger" : test.outcome === "hidden" ? "text-content-muted" : ""
                }`}
              >
                {test.name}
              </Mono>
              <Mono className={`text-[10px] ${isFail ? "text-danger" : "text-content-muted"}`}>
                {outcome.label(test)}
              </Mono>
            </div>
          );
        })}
      </div>

      <div className="border-b border-line px-3 py-2.5">
        <Eyebrow>Complexity</Eyebrow>
        <div className="mt-2 flex flex-col gap-[5px]">
          {task.complexity.map((row) => (
            <div key={row.label} className="flex justify-between text-xs">
              <span className="text-content-subtle">{row.label}</span>
              <Mono className={row.tone === "warning" ? "text-warning" : undefined}>{row.value}</Mono>
            </div>
          ))}
        </div>
        {task.complexityNote && (
          <p className="t-xs mt-2 leading-[1.5] text-content-muted">{task.complexityNote}</p>
        )}
      </div>
    </div>
  );
}
