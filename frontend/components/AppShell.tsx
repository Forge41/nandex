"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useProject } from "@/lib/project";
import styles from "./AppShell.module.css";

type Conversation = { id: string; title: string; updated_at: string };

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("nx-theme");
    return stored === "light" || stored === "dark" ? stored : null;
  });

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  const toggle = () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = (theme ?? (prefersDark ? "dark" : "light")) === "dark" ? "light" : "dark";
    window.localStorage.setItem("nx-theme", next);
    setTheme(next);
  };

  return toggle;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { project } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const toggleTheme = useTheme();
  const [showHistory, setShowHistory] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!project) return;
    api
      .get<Conversation[]>(`/chat/conversations?project_id=${project.id}`)
      .then(setConversations)
      .catch(() => {});
  }, [project, pathname]);

  const newConversation = async () => {
    if (!project) return;
    const conversation = await api.post<Conversation>("/chat/conversations", { project_id: project.id });
    router.push(`/c/${conversation.id}`);
  };

  return (
    <div className={styles.shell}>
      <div className={styles.rail}>
        <div className={styles.logo}>N</div>

        <button className={styles.railButton} onClick={newConversation} title="New conversation">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          className={styles.railButton}
          data-active={showHistory}
          onClick={() => setShowHistory((v) => !v)}
          title="History"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
        </button>

        <Link href="/integrations" className={styles.railButton} data-active={pathname === "/integrations"} title="Integrations">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3v4a2 2 0 0 1-2 2H3" />
            <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
            <path d="M3 9v6a2 2 0 0 0 2 2h4" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </Link>

        <div className={styles.railSpacer} />

        <button className={styles.railButton} onClick={toggleTheme} title="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
      </div>

      {showHistory && (
        <div className={styles.historyPanel}>
          <div className={styles.historyHeader}>
            <span className={styles.historyTitle}>History</span>
            <span className={styles.historySubtitle}>Your recent conversations</span>
          </div>
          <div className={styles.historyList}>
            {conversations.length === 0 && <span className={styles.historyEmpty}>No conversations yet</span>}
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.id}`}
                className={styles.historyItem}
                data-active={pathname === `/c/${c.id}`}
              >
                <span className={styles.historyItemTitle}>{c.title || "New conversation"}</span>
                <span className={styles.historyItemDate}>{new Date(c.updated_at).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
