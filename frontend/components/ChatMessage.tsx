import ReactMarkdown from "react-markdown";
import type { Citation } from "@/lib/sse";
import styles from "./ChatMessage.module.css";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
};

/** One entry per distinct raw_document_id -- a document cited by more than one chunk
 * still counts, and is named, once. Falls back to a bare count when no citation in the
 * group carries a display_name (rows written before that field existed). */
function sourceLabel(citations: Citation[]): string {
  const byDocument = new Map<string, string>();
  for (const c of citations) {
    if (!byDocument.has(c.raw_document_id)) byDocument.set(c.raw_document_id, c.display_name);
  }
  const names = [...byDocument.values()].filter(Boolean);
  if (names.length === byDocument.size) return names.join(", ");
  const count = byDocument.size;
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  return (
    <div className={styles.assistantColumn}>
      <div className={styles.assistantText}>
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.citations.length > 0 && (
        <div className={styles.sourcesChip}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className={styles.sourceNames}>{sourceLabel(message.citations)}</span>
        </div>
      )}
    </div>
  );
}
