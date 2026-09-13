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
import type { CodeLanguage } from "@/lib/interview/types";
import { MissingRoundContent } from "./missing-round-content";

const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  python: "Python",
  go: "Go",
  typescript: "TS",
  sql: "SQL",
};

const LANGUAGE_CHIP: Record<CodeLanguage, string> = {
  python: "py",
  go: "go",
  typescript: "ts",
  sql: "sql",
};

export function CodingStage() {
  const { session, dispatch } = useInterviewSession();
  const task = session.content.coding;

  const [activeFile, setActiveFile] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<CodeLanguage>(task?.languages[0] ?? "python");

  if (!task) return <MissingRoundContent />;

  const file = task.files[activeFile];
  const value = drafts[file.name] ?? file.content;

  return (
    <div className="flex min-h-0 flex-1">
      <TaskBriefPanel task={task} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-surface">
          {task.files.map((candidate, index) => (
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
            <Segmented value={language} onValueChange={(next) => next && setLanguage(next as CodeLanguage)}>
              {task.languages.map((option) => (
                <SegmentedItem key={option} value={option}>
                  {LANGUAGE_LABEL[option]}
                </SegmentedItem>
              ))}
            </Segmented>
            <Button variant="secondary" size="sm" disabled title="Needs the execution sandbox">
              Run tests
            </Button>
            <Button variant="primary" size="sm" onClick={() => dispatch({ type: "ADVANCE" })}>
              Submit
            </Button>
          </div>
        </div>

        <Group orientation="vertical" className="min-h-0 flex-1">
          <Panel defaultSize="62%" minSize="25%" className="flex min-h-0 flex-col">
            <CodeSurface
              key={file.name}
              value={value}
              language={file.language}
              readOnly={file.readOnly}
              onChange={(next) => setDrafts((current) => ({ ...current, [file.name]: next }))}
            />
          </Panel>

          <Separator className="h-px shrink-0 bg-line transition-colors hover:bg-line-interactive" />

          <Panel defaultSize="38%" minSize="15%" className="flex min-h-0">
            <TerminalPanel
              title="Terminal"
              lines={task.terminal}
              exitCode={task.exitCode}
              className="min-w-0 flex-1"
            />
            <TestCasePanel task={task} />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
