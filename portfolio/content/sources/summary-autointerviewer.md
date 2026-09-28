---
doc: summary.md
title: AutoInterviewer (formerly nandex)
---

AutoInterviewer, formerly called nandex, is Nandisha's open-source AI interviewer, live at autointerviewer.nandish.online with code at github.com/NandishNaik01/nandex. A candidate uploads a resume; within about 5 seconds it becomes a tailored interview plan, and a LiveKit voice agent (Deepgram speech-to-text, Cartesia text-to-speech, Claude) runs the interview, with sandboxed coding and SQL rounds. Underneath is a full RAG platform: a credential broker (tps) for connecting third-party apps, Temporal workflows that import their data and ingest it (parse → chunk → embed → index with pgvector), hybrid search fused by Reciprocal Rank Fusion with cross-encoder reranking, and chat with streamed, structured citations. The same backend and voice agent power this portfolio.
