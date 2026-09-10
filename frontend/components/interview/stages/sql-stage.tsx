"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { CodeSurface } from "@/components/ui/code-surface";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { MissingRoundContent } from "./missing-round-content";

export function SqlStage() {
  const { session, dispatch } = useInterviewSession();
  const task = session.content.sql;
  const roundNumber = session.rounds.findIndex((r) => r.id === "sql") + 1;
  const [query, setQuery] = useState(task?.query ?? "");

  if (!task) return <MissingRoundContent />;

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
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line px-5.5 py-4">
          <Eyebrow>Round {roundNumber} · SQL</Eyebrow>
          <p className="t-body mt-1.5 max-w-[78ch]">{task.prompt}</p>
        </div>

        <div className="shrink-0 border-b border-line px-5.5 py-3.5">
          <div className="overflow-hidden rounded-sm border border-line">
            <CodeSurface value={query} language="sql" onChange={setQuery} className="max-h-[220px]" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" size="sm" disabled title="Needs a connected read replica">
              Run query
            </Button>
            <Button variant="secondary" size="sm" disabled title="Needs a connected read replica">
              Explain plan
            </Button>
            <Button variant="primary" size="sm" onClick={() => dispatch({ type: "ADVANCE" })}>
              Submit answer
            </Button>
            {task.timing && <Mono className="text-2xs text-content-muted">{task.timing}</Mono>}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-surface-subtle">
                {task.columns.map((column, index) => (
                  <th
                    key={column}
                    className={`border-b border-line-strong px-3.5 py-2 font-medium text-content-subtle ${
                      task.numericColumns.includes(index) ? "text-right" : "text-left"
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="t-mono">
              {task.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`border-b border-line px-3.5 py-[7px] ${
                        task.numericColumns.includes(cellIndex) ? "text-right" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {task.caveat && (
            <Banner tone="warning" className="mx-5.5 my-3.5">
              <span>{task.caveat}</span>
            </Banner>
          )}
        </div>
      </div>
    </div>
  );
}
