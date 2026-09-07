"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useProject } from "@/lib/project";
import styles from "./empty.module.css";

type Conversation = { id: string; updated_at: string };

export default function ChatHomePage() {
  const { project } = useProject();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!project) return;
    api
      .get<Conversation[]>(`/chat/conversations?project_id=${project.id}`)
      .then((conversations) => {
        if (conversations.length > 0) {
          router.replace(`/c/${conversations[0].id}`);
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [project, router]);

  if (!checked) return null;

  return (
    <div className={styles.empty}>
      <div className={styles.iconCircle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className={styles.copy}>
        <span className={styles.title}>Nothing to chat about yet</span>
        <span className={styles.subtitle}>Connect a data source to start asking questions.</span>
      </div>
      <Link href="/integrations" className={styles.cta}>
        Connect a source
      </Link>
    </div>
  );
}
