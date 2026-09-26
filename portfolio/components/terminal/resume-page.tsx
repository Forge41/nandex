"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { LINKS } from "@/lib/terminal/constants";

let resumePdf: Promise<PDFDocumentProxy> | null = null;

function loadResume(): Promise<PDFDocumentProxy> {
  resumePdf ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs.getDocument(LINKS.resume).promise;
  });
  return resumePdf;
}

export function useResumePageCount(): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    let live = true;
    loadResume()
      .then((pdf) => live && setCount(pdf.numPages))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return count;
}

/** Page `page` of the real résumé PDF, drawn at the container's width, so what is shown is
 * exactly what downloads. */
export function ResumePage({ page = 1, className }: { page?: number; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState("612 / 792");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    const draw = async () => {
      try {
        const pdfPage = await (await loadResume()).getPage(page);
        const base = pdfPage.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(`${base.width} / ${base.height}`);
        const width = wrap.clientWidth || base.width;
        const viewport = pdfPage.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task?.cancel();
        task = pdfPage.render({ canvas, viewport });
        await task.promise;
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === "RenderingCancelledException")) setFailed(true);
      }
    };

    void draw();
    let lastWidth = wrap.clientWidth;
    const observer = new ResizeObserver(() => {
      if (wrap.clientWidth === lastWidth) return;
      lastWidth = wrap.clientWidth;
      void draw();
    });
    observer.observe(wrap);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
    };
  }, [page]);

  return (
    <div ref={wrapRef} className={className} style={{ aspectRatio: aspect, background: "white" }}>
      {failed ? (
        <a href={LINKS.resume} target="_blank" className="flex size-full items-center justify-center text-xs text-content-muted">
          open résumé.pdf
        </a>
      ) : (
        <canvas ref={canvasRef} aria-label={`résumé, page ${page}`} className="block size-full" />
      )}
    </div>
  );
}
