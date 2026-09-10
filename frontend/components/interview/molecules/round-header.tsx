import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/typography";

/** Eyebrow, prompt, and an optional right-hand slot for badges or a timer.
 * Shared by the behavioural, SQL, debug and design rounds. */
export function RoundHeader({
  eyebrow,
  eyebrowAside,
  prompt,
  serif,
  aside,
  children,
  className,
}: {
  eyebrow: string;
  /** Sits beside the eyebrow, outside its uppercase styling. */
  eyebrowAside?: React.ReactNode;
  prompt: string;
  /** The behavioural round sets its question in the serif display face. */
  serif?: boolean;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-5 border-b border-line px-7 py-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          {eyebrowAside}
        </div>
        <p
          className={cn(
            "mt-1.5",
            serif ? "max-w-[60ch] font-serif text-xl leading-[1.35]" : "t-body max-w-[80ch]"
          )}
        >
          {prompt}
        </p>
        {children}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}
