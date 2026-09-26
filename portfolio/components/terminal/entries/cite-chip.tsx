"use client";

export const citeStyle = (active = false): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 16,
  height: 15,
  padding: "0 3px",
  margin: "0 2px",
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 3,
  verticalAlign: 2,
  border: "1px solid " + (active ? "var(--t-accent)" : "var(--t-dim)"),
  color: active ? "var(--t-bg)" : "var(--t-accent)",
  background: active ? "var(--t-accent)" : "transparent",
});

export function CiteChip({ n, title, onOpen, flush }: { n: number; title: string; onOpen: () => void; flush?: boolean }) {
  return (
    <button
      type="button"
      className="t-reset"
      title={title}
      aria-label={`source ${n}: ${title}`}
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen();
      }}
      style={{ ...citeStyle(), ...(flush ? { margin: 0 } : {}) }}
    >
      {n}
    </button>
  );
}
