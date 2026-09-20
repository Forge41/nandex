import { cn } from "@/lib/utils";

/** Resume body copy, as the candidate wrote it.
 *
 * Paragraphs of their own text and nothing layered on top: the runs, the underlines and
 * the numbered chips are gone, so there is no annotation here to keep faithful to a
 * document this only ever quotes. */
export function ResumeProse({
  paragraphs,
  className,
}: {
  paragraphs: string[];
  className?: string;
}) {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={cn("max-w-[70ch] leading-[1.75]", index > 0 && "mt-3.5", className)}
        >
          {paragraph}
        </p>
      ))}
    </>
  );
}
