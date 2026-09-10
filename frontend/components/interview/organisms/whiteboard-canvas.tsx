import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/typography";
import { LiveDot } from "@/components/ui/indicators";
import type { DesignEdge, DesignNode } from "@/lib/interview/types";

const NODE_VARIANT = {
  solid: "border-[1.5px] border-content bg-surface",
  dashed: "border-[1.5px] border-dashed border-content-subtle bg-surface",
  filled: "border-[1.5px] border-content bg-tag-blue",
} as const;

/** Orthogonal connector between two boxes. Emits a straight line when the
 * boxes share a centre axis and an L-shaped path otherwise, so a moved node
 * degrades to a bend rather than a diagonal through the diagram. */
function connectorPoints(from: DesignNode, to: DesignNode): string {
  const fromMidY = from.y + from.height / 2;
  const toMidY = to.y + to.height / 2;
  const fromMidX = from.x + from.width / 2;
  const toMidX = to.x + to.width / 2;

  if (Math.abs(fromMidY - toMidY) < 1) {
    const startX = from.x < to.x ? from.x + from.width : from.x;
    const endX = from.x < to.x ? to.x : to.x + to.width;
    return `${startX},${fromMidY} ${endX},${toMidY}`;
  }

  if (Math.abs(fromMidX - toMidX) < 1) {
    const startY = from.y < to.y ? from.y + from.height : from.y;
    const endY = from.y < to.y ? to.y : to.y + to.height;
    return `${fromMidX},${startY} ${toMidX},${endY}`;
  }

  const startX = from.x < to.x ? from.x + from.width : from.x;
  return `${startX},${fromMidY} ${toMidX},${fromMidY} ${toMidX},${to.y < from.y ? to.y + to.height : to.y}`;
}

export function WhiteboardCanvas({
  nodes,
  edges,
  candidateNote,
}: {
  nodes: DesignNode[];
  edges: DesignEdge[];
  candidateNote?: string;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="relative min-w-0 flex-1 overflow-auto bg-surface bg-[radial-gradient(hsl(var(--border-strong))_1px,transparent_1px)] bg-[length:20px_20px]">
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {edges.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          return (
            <polyline
              key={edge.id}
              points={connectorPoints(from, to)}
              fill="none"
              stroke="hsl(var(--foreground-fg-subtle))"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className={cn(
            "absolute flex flex-col items-center justify-center rounded-sm p-2.5 text-center text-xs",
            NODE_VARIANT[node.variant]
          )}
          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
        >
          <span>{node.label}</span>
          {node.detail && (
            <span className={node.variant === "filled" ? "text-[10px] opacity-70" : "text-[10px] text-content-muted"}>
              {node.detail}
            </span>
          )}
        </div>
      ))}

      {candidateNote && (
        <div className="absolute top-[236px] left-[60px] w-[548px] rounded-md bg-surface-subtle px-3.5 py-3 text-sm">
          <Eyebrow>Candidate note</Eyebrow>
          <p className="mt-1.5 leading-[1.55]">{candidateNote}</p>
        </div>
      )}

      <div className="absolute top-5 right-5 flex items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-2.5 py-1">
        <LiveDot tone="info" size={6} />
        <span className="text-2xs text-content-subtle">Interviewer is watching the canvas</span>
      </div>
    </div>
  );
}
