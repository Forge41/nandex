"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Citation } from "@/components/ui/citation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { AudioBars } from "@/components/ui/audio-bars";
import { LiveDot, StatusDot, TypingCaret } from "@/components/ui/indicators";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { SkeletonLines } from "@/components/ui/skeleton-lines";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { MicIcon, VideoIcon, MonitorIcon, CaptionsIcon } from "@/components/interview/icons";
import { ThemeToggle } from "@/components/interview/molecules/theme-toggle";
import type { Tone } from "@/lib/interview/types";

const TONES: Tone[] = ["neutral", "success", "warning", "danger", "info", "violet", "jade", "gold", "olive"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <Eyebrow>{title}</Eyebrow>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  const [checked, setChecked] = useState(true);
  const [lang, setLang] = useState("python");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="t-title">Design system</h1>
          <p className="t-small mt-1 text-content-subtle">Atoms for the interview room.</p>
        </div>
        <ThemeToggle size="default" />
      </header>

      <Section title="Type scale">
        <div className="flex w-full flex-col gap-1.5">
          <span className="t-display">Display — serif</span>
          <span className="t-title">Title — serif</span>
          <span className="t-h1">Heading 1</span>
          <span className="t-h2">Heading 2</span>
          <span className="t-h3">Heading 3</span>
          <span className="t-body-md">Body medium, 15px</span>
          <span className="t-body">Body, 14px</span>
          <span className="t-small text-content-subtle">Small, 13px subtle</span>
          <span className="t-xs text-content-muted">Extra small, 12px muted</span>
          <Eyebrow>Eyebrow label</Eyebrow>
          <Mono>mono 12px · 08:12</Mono>
        </div>
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">End session</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </Section>

      <Section title="Button sizes">
        <Button size="default" variant="secondary">
          Default 32
        </Button>
        <Button size="sm" variant="secondary">
          Small 24
        </Button>
        <Button size="xs" variant="ghost">
          Extra small 20
        </Button>
        <Button size="icon" variant="secondary">
          <MicIcon />
        </Button>
        <Button size="icon-sm" variant="secondary">
          <MicIcon />
        </Button>
      </Section>

      <Section title="Badges">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Section>

      <Section title="Badges — small">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone} size="sm">
            {tone}
          </Badge>
        ))}
      </Section>

      <Section title="Tags">
        <Tag>resume line 4</Tag>
        <Tag variant="outline">
          resume line 4<Citation n={2} />
        </Tag>
        <Tag variant="inverted">your answer to Q1</Tag>
      </Section>

      <Section title="Citations in prose">
        <p className="t-body-md max-w-[70ch] leading-[1.75]">
          Owned the double-entry ledger service handling{" "}
          <span className="border-b border-dashed border-content-muted">1.4M transactions a day</span>
          <Citation n={1} />. Led the migration to a{" "}
          <span className="border-b border-dashed border-content-muted">Kafka-backed event pipeline</span>
          <Citation n={2} selected />, cutting settlement latency by 40%
          <Citation n={3} />.
        </p>
      </Section>

      <Section title="Banners">
        <div className="flex w-full flex-col gap-2">
          <Banner tone="info">Rounds unlock one at a time. You&apos;ll always see what&apos;s next before it starts.</Banner>
          <Banner tone="success">Level healthy · peak −12 dB, no clipping</Banner>
          <Banner tone="warning">Backlight detected — try facing a window or lamp</Banner>
          <Banner tone="danger">Connection lost. Reconnecting…</Banner>
        </div>
      </Section>

      <Section title="Form controls">
        <Input placeholder="Default input" className="w-56" />
        <Input variant="filled" placeholder="Filled input" className="w-56" />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          This session is recorded
        </label>
      </Section>

      <Section title="Textarea">
        <Textarea placeholder="Anything the agent got wrong?" className="h-[76px] w-full resize-none" />
      </Section>

      <Section title="Segmented control">
        <Segmented value={lang} onValueChange={(v) => v && setLang(v)}>
          <SegmentedItem value="python">Python</SegmentedItem>
          <SegmentedItem value="go">Go</SegmentedItem>
          <SegmentedItem value="ts">TS</SegmentedItem>
        </Segmented>
      </Section>

      <Section title="Icon buttons">
        <IconButton aria-label="Microphone on">
          <MicIcon />
        </IconButton>
        <IconButton danger aria-label="Microphone muted">
          <MicIcon />
        </IconButton>
        <IconButton off aria-label="Camera off">
          <VideoIcon />
        </IconButton>
        <IconButton off aria-label="Not sharing screen">
          <MonitorIcon />
        </IconButton>
        <IconButton off aria-label="Captions off">
          <CaptionsIcon />
        </IconButton>
        <IconButton size="sm" aria-label="Small">
          <MicIcon width={13} height={13} />
        </IconButton>
      </Section>

      <Section title="Indicators">
        <span className="flex items-center gap-2 rounded-full border border-line bg-surface-subtle py-1 pr-2.5 pl-2">
          <LiveDot />
          <span className="text-xs font-medium">Live</span>
          <span className="h-3 w-px bg-line-strong" />
          <Mono className="text-xs text-content-subtle">34:18</Mono>
          <span className="text-xs text-content-muted">/ 75:00</span>
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot tone="success" /> <span className="t-xs">passed</span>
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot tone="danger" /> <span className="t-xs">failed</span>
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot tone="disabled" /> <span className="t-xs">hidden</span>
        </span>
        <span className="t-body">
          still speaking
          <TypingCaret className="ml-[3px]" />
        </span>
      </Section>

      <Section title="Audio bars">
        <AudioBars className="h-4" />
        <span className="flex h-9 w-[62px] items-center rounded-sm bg-surface-subtle py-[9px]">
          <AudioBars barWidth={3} gap={4} className="h-full w-full" />
        </span>
        <span className="flex h-[120px] w-64 items-center justify-center rounded-lg bg-surface-interactive">
          <AudioBars barWidth={8} gap={8} className="h-16 text-content-on-color" />
        </span>
        <AudioBars className="h-8" levels={[0.3, 0.7, 1, 0.5, 0.2]} />
      </Section>

      <Section title="Segmented progress">
        <SegmentedProgress
          segments={["on", "on", "on", "active", "off", "off", "off", "off"]}
          className="w-full gap-1"
        />
        <SegmentedProgress segments={["danger", "warning", "off"]} segmentClassName="h-1" className="w-40 gap-1" />
        <SegmentedProgress
          segments={["on", "on", "active", "off", "off", "off", "off", "off", "off", "off"]}
          segmentClassName="h-[3px] w-2 flex-none"
          className="gap-[3px]"
        />
      </Section>

      <Section title="Avatars">
        <Avatar>
          <AvatarFallback>PR</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback>PR</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback className="bg-surface-interactive text-content-on-color">AI</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>MO</AvatarFallback>
        </Avatar>
      </Section>

      <Section title="Cards & document preview">
        <Card className="flex-1 p-4">
          <Eyebrow>Resume</Eyebrow>
          <p className="t-small mt-2 text-content-subtle">Default card surface.</p>
        </Card>
        <Card variant="subtle" className="flex-1 p-4">
          <Eyebrow>Generated plan</Eyebrow>
          <p className="t-small mt-2 text-content-subtle">Subtle card surface.</p>
        </Card>
        <div className="w-40 rounded-sm border border-line-strong bg-surface p-3">
          <SkeletonLines widths={[100, 96, 88, 64]} />
        </div>
      </Section>
    </div>
  );
}
