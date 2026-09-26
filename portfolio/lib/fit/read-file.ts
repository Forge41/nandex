async function pdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages.join("\n");
}

export async function readJobDescription(file: File): Promise<string> {
  const raw = /pdf$/i.test(file.name) || file.type === "application/pdf" ? await pdfText(file) : await file.text();
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("empty");
  return text;
}
