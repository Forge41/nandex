import { Badge } from "@/components/ui/badge";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { attemptSegments, attemptsUsed } from "@/lib/interview/coding";
import type { CodingTask } from "@/lib/interview/types";

export function TaskBriefPanel({ task }: { task: CodingTask }) {
  return (
    <div className="scrollbar-thin w-[300px] shrink-0 overflow-y-auto border-r border-line bg-surface-subtle px-4.5 pt-4.5 pb-6">
      <div className="flex items-center gap-1.5">
        <Eyebrow>
          Task {task.index} of {task.total}
        </Eyebrow>
        <Badge tone={task.difficulty} size="sm">
          {task.difficultyLabel}
        </Badge>
      </div>

      <h3 className="t-h3 mt-2">{task.title}</h3>

      {task.brief.map((paragraph, index) => (
        <p key={index} className="t-small mt-2.5 leading-[1.6] text-content-subtle">
          {paragraph}
        </p>
      ))}

      <div className="mt-4 h-px bg-line-strong" />

      <Eyebrow className="mt-3.5 block">Example</Eyebrow>
      <pre className="t-mono mt-2 overflow-x-auto rounded-sm border border-line bg-surface p-2.5 text-2xs leading-[1.6]">
        {task.example}
      </pre>

      <Eyebrow className="mt-4 block">Constraints</Eyebrow>
      <ul className="t-xs mt-2 list-disc pl-4 leading-[1.7] text-content-subtle">
        {task.constraints.map((constraint) => (
          <li key={constraint}>{constraint}</li>
        ))}
      </ul>

      <div className="mt-4 rounded-md border border-line bg-surface p-2.5">
        <div className="flex items-center justify-between">
          <Eyebrow>Attempts</Eyebrow>
          <Mono className="text-xs">
            {attemptsUsed(task)} / {task.attemptsAllowed}
          </Mono>
        </div>
        <SegmentedProgress
          className="mt-2 gap-1"
          segmentClassName="h-1"
          segments={attemptSegments(task)}
        />
        {task.lastRunSummary && <p className="t-xs mt-2 text-content-muted">{task.lastRunSummary}</p>}
      </div>
    </div>
  );
}
