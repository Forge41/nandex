# The interviewer

A LiveKit agent that joins an interview room, greets the candidate, and walks them
through the plan generated from their own resume.

Its own project rather than part of `backend/`: it is a separate deployable with a
different dependency set, and it reaches core over HTTP like any other client. It has no
database connection and no tps or vas client — core is the orchestrator.

## Running it

```bash
make interviewer-agent          # or: cd agent && uv run python -m interviewer.main dev
```

`make serve-all` starts it with the rest of the stack.

## What it needs

Everything comes from `backend/.env`, so the agent and core cannot disagree about the
same value.

| | |
| --- | --- |
| `INTERVIEW_AGENT_NAME` | Must match the name core puts in the join token, or the dispatch reaches nobody |
| `INTERVIEW_AGENT_BEARER_TOKEN` | The agent's own door into core. Empty rejects every request |
| `INTERVIEW_CORE_BASE_URL` | The core process, not the frontend — no `/api` prefix |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | The agent SDK's own names for the pair `TPS_LIVEKIT_*` holds |
| `AI_ANTHROPIC_API_KEY` | Shared with core; `ANTHROPIC_API_KEY` is accepted too |
| `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY` | Speech in and speech out |

**Without both speech keys the interviewer still runs**, and says everything it would
have said as text — the live transcript panel renders it either way. Silence would be
worse: a candidate cannot tell a missing API key from a broken product. Add both keys and
it speaks, with no code change.

## How it is dispatched

Explicitly. `tps` signs the candidate's join token with `roomConfig.agents`, naming this
worker and carrying the session id, so the worker only ever joins a room whose token
asked for one. The session id arrives as `ctx.job.metadata` — the room name is core's
business, and parsing it here would make a rename in core a silent break.
