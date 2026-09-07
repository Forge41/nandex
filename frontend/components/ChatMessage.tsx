import type { Citation } from "@/lib/sse";
import styles from "./ChatMessage.module.css";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
};

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  const sourceCount = new Set(message.citations.map((c) => c.raw_document_id)).size;

  return (
    <div className={styles.assistantColumn}>
      <div className={styles.assistantText}>{message.content}</div>
      {sourceCount > 0 && (
        <div className={styles.sourcesChip}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{sourceCount} {sourceCount === 1 ? "source" : "sources"}</span>
        </div>
      )}
    </div>
  );
}
