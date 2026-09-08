"use client";

import { use, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { parseSSEStream } from "@/lib/sse";
import { ChatMessage, type Message } from "@/components/ChatMessage";
import { Composer } from "@/components/Composer";
import styles from "./page.module.css";

type Conversation = { id: string; title: string; messages: Message[] };

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Conversation>(`/chat/conversations/${conversationId}`).then((c) => {
      setTitle(c.title);
      setMessages(c.messages);
    });
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) window.clearInterval(revealTimerRef.current);
    };
  }, []);

  const send = async (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, citations: [] },
    ]);
    setStreaming(true);

    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", citations: [] }]);

    // The backend streams real deltas, but each one lands as a whole sentence fragment
    // every ~1s -- rendered as-is, that reads as chunky jumps rather than a typing effect.
    // fullText accumulates every delta as it arrives (network pace); revealedLength is
    // driven by a fixed-tick timer so the UI always reveals character-by-character, and
    // speeds up (revealing a fraction of the backlog per tick) if it ever falls behind.
    let fullText = "";
    let revealedLength = 0;
    let receiving = true;

    if (revealTimerRef.current !== null) window.clearInterval(revealTimerRef.current);
    revealTimerRef.current = window.setInterval(() => {
      if (revealedLength >= fullText.length) {
        if (!receiving && revealTimerRef.current !== null) {
          window.clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        return;
      }
      const backlog = fullText.length - revealedLength;
      revealedLength = Math.min(fullText.length, revealedLength + Math.max(2, Math.ceil(backlog * 0.15)));
      const revealed = fullText.slice(0, revealedLength);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: revealed } : m)));
    }, 20);

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      for await (const frame of parseSSEStream(response)) {
        if ("delta" in frame) {
          fullText += frame.delta;
        } else if ("done" in frame) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, citations: frame.citations } : m))
          );
        }
      }
    } catch {
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong generating a response." } : m
        )
      );
    } finally {
      receiving = false;
      setStreaming(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{title || "New conversation"}</span>
      </div>

      <div className={styles.messages} ref={scrollRef}>
        <div className={styles.messagesInner}>
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
        </div>
      </div>

      <Composer onSend={send} disabled={streaming} />
    </>
  );
}
