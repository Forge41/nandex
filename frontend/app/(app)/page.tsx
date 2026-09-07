"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useProject } from "@/lib/project";

type Conversation = { id: string; updated_at: string };

/** No separate landing splash -- the whole point is to land directly in a chat, composer
 * (and its upload option) visible immediately, whether that's the most recent conversation
 * or a fresh empty one. */
export default function ChatHomePage() {
  const { project } = useProject();
  const router = useRouter();

  useEffect(() => {
    if (!project) return;
    let ignore = false;

    api.get<Conversation[]>(`/chat/conversations?project_id=${project.id}`).then((conversations) => {
      if (ignore) return;
      if (conversations.length > 0) {
        router.replace(`/c/${conversations[0].id}`);
      } else {
        api
          .post<{ id: string }>("/chat/conversations", { project_id: project.id })
          .then((conversation) => {
            if (!ignore) router.replace(`/c/${conversation.id}`);
          });
      }
    });

    return () => {
      ignore = true;
    };
  }, [project, router]);

  return null;
}
