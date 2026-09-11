"""The default round shape, and the metadata a generated round inherits.

Mirrors frontend/lib/interview/agenda.ts::DEFAULT_ROUNDS, which is now the fallback for
a session the server hasn't planned yet. A resume-derived plan overrides citation and
summary per round; label, kind and duration stay from here so the agenda's shape is
stable whether or not a resume was read.
"""

DEFAULT_ROUNDS: tuple[dict, ...] = (
    {"stage_id": "preflight", "label": "Pre-flight & resume", "kind": "setup", "duration_min": 4},
    {"stage_id": "resume", "label": "Resume review & plan", "kind": "setup", "duration_min": 6},
    {
        "stage_id": "behavioral",
        "label": "Behavioral — ownership",
        "kind": "conversation",
        "duration_min": 10,
    },
    {"stage_id": "coding", "label": "Live coding + terminal", "kind": "task", "duration_min": 25},
    {"stage_id": "sql", "label": "SQL — settlement report", "kind": "task", "duration_min": 10},
    {"stage_id": "debug", "label": "Debug drill", "kind": "task", "duration_min": 8},
    {"stage_id": "design", "label": "System design canvas", "kind": "task", "duration_min": 15},
    {"stage_id": "quiz", "label": "Knowledge check", "kind": "task", "duration_min": 5},
    {"stage_id": "qa", "label": "Your questions", "kind": "conversation", "duration_min": 8},
    {"stage_id": "wrap", "label": "Wrap-up & feedback", "kind": "setup", "duration_min": 3},
)

STAGE_IDS = tuple(round_["stage_id"] for round_ in DEFAULT_ROUNDS)

TOTAL_DURATION_MIN = sum(round_["duration_min"] for round_ in DEFAULT_ROUNDS)

# The round a live interviewer joins for. The token endpoint attaches an agent dispatch
# regardless of stage, because the browser only asks for a token when it needs one.
LIVE_STAGE_IDS = ("behavioral", "qa")
