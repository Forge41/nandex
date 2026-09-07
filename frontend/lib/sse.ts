export type Citation = { chunk_id: string; raw_document_id: string; page_idx: number };
export type ChatStreamFrame = { delta: string } | { done: true; citations: Citation[] };

/** apps/chat/service.py's SSE format: zero-or-more `data: {"delta": "..."}\n\n` frames,
 * then exactly one final `data: {"done": true, "citations": [...]}\n\n`. Always `data:`
 * only, single-line JSON -- no `event:`/`id:` fields, so a full parser buys nothing here. */
export async function* parseSSEStream(response: Response): AsyncGenerator<ChatStreamFrame> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (frame.startsWith("data: ")) yield JSON.parse(frame.slice(6));
    }
  }
}
