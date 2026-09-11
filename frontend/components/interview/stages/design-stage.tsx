"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Eyebrow } from "@/components/ui/typography";
import { WhiteboardCanvas } from "@/components/interview/organisms/whiteboard-canvas";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { MissingRoundContent } from "./missing-round-content";

/** Drawing tools are inert: the canvas renders the diagram the agent has, and
 * there is no editing model behind these yet. Shown because the round's shape
 * depends on them, disabled because they would otherwise lie. */
const TOOLS = [
  { id: "box", label: "Box", glyph: <span className="h-[9px] w-3 border-[1.5px] border-current" /> },
  { id: "circle", label: "Circle", glyph: <span className="size-[11px] rounded-full border-[1.5px] border-current" /> },
  { id: "line", label: "Line", glyph: <span className="h-[1.5px] w-[13px] bg-current" /> },
  { id: "text", label: "Text", glyph: <span className="text-[11px] font-semibold">T</span> },
];

export function DesignStage() {
  const { session, dispatch } = useInterviewSession();
  const task = session.content.design;
  const roundNumber = session.rounds.findIndex((r) => r.id === "design") + 1;
  const [tab, setTab] = useState("draw");

  if (!task) return <MissingRoundContent />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-line px-6 py-3.5">
        <div className="min-w-0 flex-1">
          <Eyebrow>Round {roundNumber} · System design</Eyebrow>
          <p className="t-body mt-1">{task.prompt}</p>
        </div>
        <Segmented value={tab} onValueChange={(next) => next && setTab(next)}>
          <SegmentedItem value="draw">Draw</SegmentedItem>
          <SegmentedItem value="notes">Notes</SegmentedItem>
          <SegmentedItem value="tradeoffs">Trade-offs</SegmentedItem>
        </Segmented>
        <Button variant="primary" size="sm" onClick={() => dispatch({ type: "ADVANCE" })}>
          Submit design
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-surface-subtle py-2.5">
          {TOOLS.map((tool, index) => (
            <button
              key={tool.id}
              type="button"
              disabled
              title={`${tool.label} — drawing isn't wired up yet`}
              className={`flex size-7 items-center justify-center rounded-sm text-content-subtle disabled:opacity-60 ${
                index === 0 ? "border border-line-strong bg-surface text-content" : ""
              }`}
            >
              {tool.glyph}
            </button>
          ))}
        </div>

        {tab === "draw" ? (
          <WhiteboardCanvas nodes={task.nodes} edges={task.edges} candidateNote={task.candidateNote} />
        ) : (
          <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-8 py-6">
            <Eyebrow>{tab === "notes" ? "Notes" : "Trade-offs"}</Eyebrow>
            <p className="t-small mt-2 max-w-[70ch] text-content-subtle">
              {tab === "notes"
                ? task.candidateNote ?? "Nothing noted yet."
                : "Talk through the trade-offs out loud — the interviewer is listening, and the transcript is the record."}
            </p>
          </div>
        )}

        <div className="scrollbar-thin w-[280px] shrink-0 overflow-y-auto border-l border-line bg-surface-subtle px-3.5 py-4">
          <Eyebrow>Probes raised so far</Eyebrow>
          <div className="mt-3 flex flex-col gap-2.5">
            {task.probes.map((probe) => (
              <div
                key={probe.id}
                className={`rounded-md border bg-surface p-2.5 ${
                  probe.answered ? "border-line" : "border-warning-border"
                }`}
              >
                <p className="t-small leading-[1.5]">“{probe.question}”</p>
                <Badge tone={probe.answered ? "success" : "warning"} size="sm" className="mt-2">
                  {probe.answered ? "answered" : "open"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
