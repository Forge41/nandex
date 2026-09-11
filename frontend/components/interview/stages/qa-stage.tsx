"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eyebrow } from "@/components/ui/typography";
import { CitationChip } from "@/components/interview/molecules/citation-chip";
import { CitationProvider } from "@/lib/interview/citation-context";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useRoomState } from "@/lib/interview/room-provider";
import { initialsOf } from "@/lib/interview/format";
import { MissingRoundContent } from "./missing-round-content";
import type { QaMessage } from "@/lib/interview/types";

function CandidateBubble({ message, initials }: { message: QaMessage; initials: string }) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[60%] rounded-lg rounded-br-xs bg-surface-component px-3.5 py-3">
        <p className="t-body">{message.text}</p>
      </div>
      <Avatar size="sm">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}

function AgentAnswer({ message }: { message: QaMessage }) {
  return (
    <div className="flex gap-3">
      <Avatar size="sm">
        <AvatarFallback className="bg-surface-interactive text-content-on-interactive">AI</AvatarFallback>
      </Avatar>
      <div className="max-w-[74%] flex-1">
        {message.routedTo ? (
          <>
            <Banner tone="info" className="items-center">
              <span>{message.text}</span>
            </Banner>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="info" size="sm">
                routed to human
              </Badge>
              <span className="t-xs text-content-muted">
                {message.routedTo.name} · {message.routedTo.replyWithin}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="t-body leading-[1.65]">
              {message.text}
              {message.citations?.map((citation) => <CitationChip key={citation} n={citation} />)}
            </p>
            {message.sources && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {message.sources.map((source) => (
                  <Tag key={source.label} variant="outline">
                    {source.label}
                  </Tag>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function QaStage() {
  const { session, dispatch } = useInterviewSession();
  const { panelOpen } = useRoomState();
  const content = session.content.qa;
  const roundNumber = session.rounds.findIndex((r) => r.id === "qa") + 1;
  const [draft, setDraft] = useState("");

  if (!content) return <MissingRoundContent />;

  const initials = initialsOf(session.candidateName);
  // The thread hugs the left when the transcript panel is open, so the two
  // columns don't fight for the same optical centre.
  const alignment = panelOpen ? "mr-auto" : "mx-auto";

  return (
    <CitationProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line px-7 pt-5.5 pb-4">
          <Eyebrow>Round {roundNumber} · Your questions</Eyebrow>
          <h2 className="t-title mt-2 text-2xl">Your turn. Ask us anything.</h2>
          <p className="t-body mt-2 max-w-[70ch] text-content-subtle">
            The agent answers from the role brief and public docs, and cites where each answer came from. Anything it
            cannot source is routed to the hiring manager.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {content.suggestions.map((suggestion) => (
              <Button key={suggestion} variant="secondary" size="sm" onClick={() => setDraft(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <div className={`flex max-w-[720px] flex-col gap-4.5 ${alignment}`}>
            {content.messages.map((message) =>
              message.role === "candidate" ? (
                <CandidateBubble key={message.id} message={message} initials={initials} />
              ) : (
                <AgentAnswer key={message.id} message={message} />
              )
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-surface-subtle px-7 pt-3 pb-3.5">
          <div className={`flex max-w-[720px] items-center gap-2 ${alignment}`}>
            <Input
              variant="filled"
              placeholder="Type a question, or just speak"
              className="min-w-0 flex-1"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button variant="secondary" className="flex-none" disabled title="Needs the live interviewer">
              Send
            </Button>
            <span className="mx-0.5 h-[22px] w-px flex-none bg-line-strong" />
            <Button variant="primary" className="flex-none" onClick={() => dispatch({ type: "ADVANCE" })}>
              I&apos;m done asking
            </Button>
          </div>
        </div>
      </div>
    </CitationProvider>
  );
}
