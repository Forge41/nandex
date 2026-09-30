"use client";

import Image from "next/image";

import { markFor } from "@/lib/terminal/marks";

/** A brand mark when one exists, a monogram when it does not. Decided in `marks.ts`, not by a 404. */
export function TechMark({ label, size = 18 }: { label: string; size?: number }) {
  const mark = markFor(label);
  if ("mono" in mark)
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-[4px] border border-tm-border font-bold tracking-[.02em] text-tm-fg"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }}
      >
        {mark.mono}
      </span>
    );
  return (
    <Image
      src={`https://cdn.simpleicons.org/${mark.slug}/ffffff`}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="block opacity-85"
    />
  );
}
