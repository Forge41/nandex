import { Eyebrow, Mono } from "@/components/ui/typography";

/** Eyebrow, hairline rule, optional right-aligned count. */
export function SectionHeading({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <Eyebrow>{label}</Eyebrow>
      <span className="h-px flex-1 bg-line" />
      {meta && <Mono className="text-2xs text-content-muted">{meta}</Mono>}
    </div>
  );
}
