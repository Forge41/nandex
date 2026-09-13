"""The default round shape, and the metadata a generated round inherits.

Mirrors frontend/lib/interview/agenda.ts::DEFAULT_ROUNDS, which is now the fallback for
a session the server hasn't planned yet. A resume-derived plan overrides citation and
summary per round; label, kind and duration stay from here so the agenda's shape is
stable whether or not a resume was read.
"""

# The whole interview as designed. `shipped` is what a candidate actually sits.
#
# A round ships once it is real end to end: its content is generated or imported, and what
# the screen says happened is what happened. The rest are built screens with no honest
# material behind them -- their runtime fields (test outcomes, terminal output, result
# rows, canvas geometry) are exactly the fabrications the coding and SQL rounds were
# rebuilt to remove, and shipping them would put back what that work took out.
#
# Kept here rather than deleted so the intended shape stays visible and re-enabling one is
# a single word.
ALL_ROUNDS: tuple[dict, ...] = (
    {
        "stage_id": "preflight",
        "label": "Pre-flight & resume",
        "kind": "setup",
        "duration_min": 4,
        "shipped": True,
    },
    {
        "stage_id": "resume",
        "label": "Resume review & plan",
        "kind": "setup",
        "duration_min": 6,
        "shipped": True,
    },
    {
        "stage_id": "behavioral",
        "label": "Behavioral — ownership",
        "kind": "conversation",
        "duration_min": 10,
        "shipped": True,
    },
    {
        "stage_id": "coding",
        "label": "Live coding + terminal",
        "kind": "task",
        "duration_min": 25,
        "shipped": True,
    },
    {
        "stage_id": "sql",
        "label": "SQL — settlement report",
        "kind": "task",
        "duration_min": 10,
        "shipped": True,
    },
    {"stage_id": "debug", "label": "Debug drill", "kind": "task", "duration_min": 8},
    {"stage_id": "design", "label": "System design canvas", "kind": "task", "duration_min": 15},
    {"stage_id": "quiz", "label": "Knowledge check", "kind": "task", "duration_min": 5},
    {"stage_id": "qa", "label": "Your questions", "kind": "conversation", "duration_min": 8},
    # Shipped, and not a round in the ordinary sense: the closing screen. It is built
    # from the session rather than generated, which is why it ships while the graded
    # rounds around it do not -- and why ending an interview has somewhere to land.
    {
        "stage_id": "wrap",
        "label": "Wrap-up",
        "kind": "setup",
        "duration_min": 3,
        "shipped": True,
    },
)

# The flag is a fact about the catalogue, not about a round, so it does not survive the
# filter -- these dicts are spread straight into InterviewRound.
DEFAULT_ROUNDS: tuple[dict, ...] = tuple(
    {k: v for k, v in round_.items() if k != "shipped"}
    for round_ in ALL_ROUNDS
    if round_.get("shipped")
)

STAGE_IDS = tuple(round_["stage_id"] for round_ in DEFAULT_ROUNDS)

TOTAL_DURATION_MIN = sum(round_["duration_min"] for round_ in DEFAULT_ROUNDS)

# The rounds a live interviewer joins for. The token endpoint attaches an agent dispatch
# regardless of stage, because the browser only asks for a token when it needs one.
# "resume" is here because the interviewer greets the candidate over the generated plan
# and can be asked about it before anything is timed or scored.
# "coding" is here because an interviewer who cannot see the failing test cannot ask the
# one question the round exists for. What it is given is the task and the run's counts --
# never the candidate's source. "qa" belongs here too and is absent because the round is
# not shipped.
LIVE_STAGE_IDS = ("resume", "behavioral", "coding")
