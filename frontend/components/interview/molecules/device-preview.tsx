"use client";

import { useEffect, useRef } from "react";
import { AudioBars } from "@/components/ui/audio-bars";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/** Every preview occupies exactly this box, whatever it contains, so the three
 * device rows line up in a column instead of drifting with their content. */
const PREVIEW_BOX = "h-9 w-[62px] shrink-0 overflow-hidden rounded-sm";

/** Binds a MediaStream to a <video>.
 *
 * A stream feeds any number of elements, so the row thumbnail and the overlay
 * show the same camera rather than each opening it -- a second acquisition of
 * one device fails outright on some hardware. */
export function StreamVideo({
  stream,
  mirrored,
  className,
}: {
  stream: MediaStream | null;
  mirrored?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) {
      void element.play().catch(() => {
        // Autoplay can be refused even when muted; the element then holds its
        // first frame, which is still a truthful preview.
      });
    }
    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      muted
      playsInline
      className={cn("size-full object-cover", className)}
      // Mirrored for a camera, never for a screen: a flipped screen share is
      // unreadable.
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

/** Live bars when the microphone is open, flat when it is not.
 *
 * Flat rather than self-animating: in a device check, motion reads as "this
 * works", and it must not say that about a device nobody has opened. */
export function MicPreview({ levels, live }: { levels: number[]; live: boolean }) {
  return (
    <span className={cn(PREVIEW_BOX, "flex items-center bg-surface-subtle px-1.5 py-[9px]")}>
      <AudioBars
        barWidth={3}
        gap={4}
        className="h-full w-full"
        levels={live ? levels : [0.08, 0.08, 0.08, 0.08, 0.08]}
      />
    </span>
  );
}

export function VideoPreview({
  stream,
  mirrored,
  placeholder,
}: {
  stream: MediaStream | null;
  mirrored?: boolean;
  placeholder: string;
}) {
  return (
    <span className={cn(PREVIEW_BOX, "bg-stripes relative flex items-center justify-center")}>
      {stream ? (
        <StreamVideo stream={stream} mirrored={mirrored} />
      ) : (
        <Mono className="text-[9px] leading-none text-content-muted">{placeholder}</Mono>
      )}
    </span>
  );
}

export { PREVIEW_BOX };
