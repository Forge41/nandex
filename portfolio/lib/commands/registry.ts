import { gitlog, history, manpage, projects, ps, skills, tree } from "@/content/data";
import { isTheme, LINKS, THEMES } from "@/lib/terminal/constants";
import { err, L, lines, LS, prose } from "@/lib/terminal/lines";
import { uptime } from "@/lib/terminal/time";
import type { EntryBody, Line, ThemeName } from "@/lib/terminal/types";
import type { Source } from "@/lib/types";

export const SHELL_COMMANDS: [string, string][] = [
  ["whoami", "portrait + intro  (--real for the photo)"],
  ["neofetch", "re-render the info panel"],
  ["ls projects/", "project list"],
  ["cat projects/<name>.md", "full project write-up"],
  ["tree ~/career", "career timeline"],
  ["git log --author=nandisha", "experience as commits"],
  ["cat skills.json | jq", "skills as JSON"],
  ["grep <skill> -r ~/", "where I used a skill"],
  ["ps aux", "what I'm working on"],
  ["uptime", "experience as uptime"],
  ["man nandisha", "manual page"],
  ["curl nandisha.dev/contact", "contact info"],
  ["wget resume.pdf", "download résumé"],
  ["ping nandisha", "availability"],
  ["history", "popular questions"],
  ["sudo hire nandisha", "…"],
  ["clear", "clear screen"],
];

export const SLASH_COMMANDS: [string, string][] = [
  ["help", "all commands"],
  ["clear", "clear conversation"],
  ["voice", "talk to the agent (open mic)"],
  ["fit", "paste a JD → cited fit analysis"],
  ["book", "schedule a call"],
  ["message", "leave me a message"],
  ["theme <name>", "default · dracula · gruvbox · nord"],
  ["gui", "clean non-terminal view"],
  ["verbose", "toggle debug info per answer"],
  ["sources", "documents I answer from"],
  ["export", "download conversation as markdown"],
  ["share", "copy a link that replays this conversation"],
  ["recruiter", "one-screen summary for people who won't type"],
  ["tour", "run every command, one after another"],
  ["interview", "try nandex's AI interview room"],
  ["reload", "start over from the loading screen"],
];

export const PRIVACY_NOTE = "questions are logged anonymously (no IP) for 90 days to improve answers.";

export type CommandContext = {
  sources: Source[];
  byId: Record<string, Source>;
  theme: ThemeName;
  verbose: boolean;
  now: number;
  clock: string;
  bookingUrl: string;
};

/** What a command asks the shell to do. Commands stay pure; the terminal owns timers, DOM and network. */
export type Effect =
  | { type: "push"; entry: EntryBody }
  | { type: "later"; ms: number; entry: EntryBody }
  | { type: "clear" }
  | { type: "openUrl"; url: string }
  | { type: "sudo" }
  | { type: "voice" }
  | { type: "tour" }
  | { type: "fitPrompt" }
  | { type: "fit"; jd: string }
  | { type: "theme"; name: ThemeName }
  | { type: "verbose"; on: boolean }
  | { type: "gui" }
  | { type: "export" }
  | { type: "share" }
  | { type: "recruiter" }
  | { type: "reload" };

const push = (entry: EntryBody): Effect => ({ type: "push", entry });

export function helpEntry(): EntryBody {
  return lines([
    L("SLASH COMMANDS", "muted"),
    ...SLASH_COMMANDS.map(([c, d]) => LS([[("/" + c).padEnd(28), "violet"], [d, "sub"]])),
    L(""),
    L("SHELL COMMANDS", "muted"),
    ...SHELL_COMMANDS.map(([c, d]) => LS([[("!" + c).padEnd(28), "accent"], [d, "sub"]])),
    L(""),
    L("anything else is a question for the agent.", "dim"),
    L(PRIVACY_NOTE, "dim"),
  ]);
}

export function shortcutsEntry(): EntryBody {
  const row = (k: string, d: string) => LS([[k.padEnd(12), "accent"], [d, "sub"]]);
  return lines([
    L("SHORTCUTS", "muted"),
    row("tab", "complete command"),
    row("↑ / ↓", "history · move in autocomplete"),
    row("esc", "interrupt · close viewer · leave voice"),
    row("ctrl+l", "clear"),
    row("q", "close source viewer"),
    row("space (hold)", "push-to-talk in /voice"),
  ]);
}

export function bookEffects(bookingUrl: string): Effect[] {
  const url = bookingUrl.trim();
  if (!url) {
    return [
      push(prose([LS([["no calendar link yet — leave a message with a few times that suit you and I'll send an invite.", "muted"]])])),
      push({ kind: "form", initial: { name: "", email: "", text: "" } }),
    ];
  }
  let host = "";
  try {
    host = new URL(url).host;
  } catch {}
  return [push({ kind: "book", url, host })];
}

function catSkills(): Line[] {
  const out: Line[] = [L("{", "muted")];
  const keys = Object.keys(skills) as (keyof typeof skills)[];
  keys.forEach((k, i) => {
    out.push(LS([[`  "${k}"`, "blue"], [": [", "muted"]]));
    skills[k].forEach((v, j) => out.push(LS([[`    "${v}"`, "green"], [j < skills[k].length - 1 ? "," : "", "muted"]])));
    out.push(L("  ]" + (i < keys.length - 1 ? "," : ""), "muted"));
  });
  out.push(L("}", "muted"));
  return out;
}

function grep(c: string, sources: Source[]): EntryBody {
  const q = c
    .replace(/^grep\s+/, "")
    .replace(/\s+-r.*$/, "")
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
  if (!q) return err("grep: missing pattern");
  const hits = sources.filter((s) => s.text.toLowerCase().includes(q));
  if (!hits.length) return prose([L(`grep: no matches for "${q}" in ~/  — try asking in plain English.`, "muted")]);
  return prose(
    hits.map((s) => {
      const i = s.text.toLowerCase().indexOf(q);
      const a = Math.max(0, i - 50);
      const b = Math.min(s.text.length, i + q.length + 70);
      return LS([
        [`~/${s.doc}/${s.id}: `, "violet"],
        [(a > 0 ? "…" : "") + s.text.slice(a, i), "sub"],
        [s.text.slice(i, i + q.length), "accent"],
        [s.text.slice(i + q.length, b) + (b < s.text.length ? "…" : ""), "sub"],
      ]);
    }),
  );
}

const isManHeading = (l: string) => /^[A-Z ]+\(?1?\)?$|^[A-Z][A-Z ]+$/.test(l.trim()) && l === l.trim();

export function runShell(c: string, ctx: CommandContext): Effect[] {
  if (/^whoami( --real)?$/.test(c)) return [push(c.includes("--real") ? { kind: "photo" } : { kind: "whoami" })];
  if (c === "neofetch") return [push({ kind: "whoami" })];
  if (/^ls( projects\/?)?$/.test(c))
    return [push(lines(projects.map((p) => LS([[p.name.padEnd(20) + ".md", "blue"], ["  " + p.one, "sub"]]))))];
  if (/^cat projects\//.test(c)) {
    const n = c.replace(/^cat projects\//, "").replace(/\.md$/, "");
    const p = projects.find((x) => x.name === n);
    if (!p) return [push(err(`cat: projects/${n}.md: No such file`))];
    const s = ctx.byId[p.src];
    return [
      push(
        prose([
          LS([["# " + p.title, "accent"], ["  (" + p.year + ")", "dim"]]),
          L(""),
          L(s?.text ?? "", "base"),
          L(""),
          LS([["stack: ", "muted"], [p.stack.join(" · "), "sub"]]),
          LS([["source: ", "muted"], [s ? `${s.doc} › ${s.title}` : p.src, "dim"]]),
        ]),
      ),
    ];
  }
  if (/^tree( ~\/career)?$/.test(c))
    return [
      push(
        lines(
          tree.map((l) =>
            LS([
              [l.replace(/  .*$/, ""), /\.md|\//.test(l) ? "base" : "muted"],
              [(l.match(/  .*$/) || [""])[0], "dim"],
            ]),
          ),
        ),
      ),
    ];
  if (/^git log/.test(c))
    return [
      push(
        lines(
          gitlog.flatMap((g) => [
            LS([["commit " + g.hash, "accent"], [g.tag ? " (" + g.tag + ")" : "", "green"]]),
            LS([["Author: Nandisha D <naik.nandishd@gmail.com>", "muted"]]),
            LS([["Date:   " + g.date, "muted"]]),
            L(""),
            LS([["    " + g.msg, "base"]]),
            L(""),
          ]),
        ),
      ),
    ];
  if (/^cat skills\.json/.test(c)) return [push(lines(catSkills()))];
  if (/^grep /.test(c)) return [push(grep(c, ctx.sources))];
  if (c === "ps aux") return [push(lines(ps.map((l, i) => L(l, i === 0 ? "muted" : "base"))))];
  if (c === "uptime")
    return [push(prose([L(` ${ctx.clock}  up ${uptime(ctx.now)},  1 user,  load average: RAG, agents, voice`, "base")]))];
  if (c === "man nandisha") return [push(lines(manpage.map((l) => L(l, isManHeading(l) ? "accent" : "base"))))];
  if (/^curl/.test(c))
    return [
      push(
        lines([
          L("HTTP/2 200", "muted"),
          L("content-type: application/json", "muted"),
          L(""),
          L("{", "muted"),
          LS([['  "email": ', "blue"], [`"${LINKS.email}"`, "green"], [",", "muted"]]),
          LS([['  "linkedin": ', "blue"], ['"linkedin.com/in/nandishd"', "green"], [",", "muted"]]),
          LS([['  "github": ', "blue"], ['"github.com/NandishNaik01"', "green"], [",", "muted"]]),
          LS([['  "site": ', "blue"], ['"nandishnaik.netlify.app"', "green"], [",", "muted"]]),
          LS([['  "timezone": ', "blue"], ['"Asia/Kolkata"', "green"]]),
          L("}", "muted"),
        ]),
      ),
    ];
  if (/^wget/.test(c))
    return [
      { type: "openUrl", url: LINKS.resume },
      push(
        prose([
          L("--2026-09-26--  https://nandisha.dev/resume.pdf", "muted"),
          LS([["resume.pdf", "base"], ["          100%[===================>]  1 page   opened in new tab", "green"]]),
        ]),
      ),
    ];
  if (/^ping/.test(c))
    return [
      push(
        prose(
          [
            "PING nandisha (Bangalore, IN): 56 data bytes",
            "64 bytes from nandisha: icmp_seq=0 ttl=64 time=open to interesting work",
            "64 bytes from nandisha: icmp_seq=1 ttl=64 time=replies within 24h",
            "--- nandisha ping statistics ---",
            "2 packets transmitted, 2 received, 0.0% packet loss",
          ].map((l, i) => L(l, i === 0 || i === 3 ? "muted" : "base")),
        ),
      ),
    ];
  if (c === "history") return [push(lines(history.map((h, i) => LS([[String(i + 1).padStart(4) + "  ", "dim"], [h, "base"]]))))];
  if (/^sudo hire/.test(c)) return [{ type: "sudo" }];
  if (/^rm -rf/.test(c)) {
    const seq: Line[] = [
      LS([["rm: removing ~/career/think41 …", "red"]]),
      LS([["rm: removing ~/projects/genalpha-cli …", "red"]]),
      LS([["rm: removing ~/skills.json …", "red"]]),
      LS([["rm: cannot remove '/': Operation not permitted", "accent"]]),
      LS([["just kidding. everything is still here — a portfolio should survive its visitors.", "green"]]),
    ];
    return seq.map((l, i) => ({ type: "later", ms: i * 260, entry: prose([l]) }));
  }
  if (c === "exit" || c === "logout")
    return [push(prose([L("exit: there is no outside. try /gui if you want fewer characters.", "muted")]))];
  if (c === "clear") return [{ type: "clear" }];
  if (c === "help") return [push(helpEntry())];
  if (c === "pwd") return [push(prose([L("/home/nandisha", "base")]))];
  if (/^echo /.test(c)) return [push(prose([L(c.slice(5), "base")]))];
  return [
    push(prose([LS([[`command not found: ${c.split(" ")[0]}`, "red"], [". Try asking me in plain English instead.", "muted"]])])),
  ];
}

export function runSlash(name: string, arg: string, ctx: CommandContext): Effect[] {
  switch (name) {
    case "help":
      return [push(helpEntry())];
    case "clear":
      return [{ type: "clear" }];
    case "voice":
      return [{ type: "voice" }];
    case "tour":
      return [{ type: "tour" }];
    case "fit":
      return arg ? [{ type: "fit", jd: arg }] : [{ type: "fitPrompt" }];
    case "book":
      return bookEffects(ctx.bookingUrl);
    case "message":
      return [push({ kind: "form", initial: { name: "", email: "", text: "" } })];
    case "theme": {
      if (!arg)
        return [
          push(
            prose([
              LS([
                ["themes: ", "muted"],
                [Object.keys(THEMES).join(" · "), "base"],
                ["   current: " + ctx.theme, "dim"],
              ]),
            ]),
          ),
        ];
      if (!isTheme(arg)) return [push(err(`/theme: unknown theme "${arg}"`))];
      return [{ type: "theme", name: arg }, push(prose([LS([["theme → ", "muted"], [arg, "accent"]])]))];
    }
    case "gui":
      return [{ type: "gui" }];
    case "verbose": {
      const on = !ctx.verbose;
      return [
        { type: "verbose", on },
        push(prose([L("verbose " + (on ? "on: answers show retrieved sources, latency, tokens." : "off."), "muted")])),
      ];
    }
    case "sources": {
      const count = (doc: string) => ctx.sources.filter((s) => s.doc === doc).length;
      return [
        push(
          prose([
            LS([["resume.pdf", "accent"], ["   " + count("resume.pdf") + " sections · Nandisha D, Sep 2026", "sub"]]),
            LS([["summary.md", "accent"], ["   " + count("summary.md") + " sections · about + open-source notes", "sub"]]),
            L('the agent answers only from these. anything else → "not in my docs".', "dim"),
          ]),
        ),
      ];
    }
    case "export":
      return [{ type: "export" }];
    case "share":
      return [{ type: "share" }];
    case "recruiter":
      return [{ type: "recruiter" }];
    case "interview":
      return [
        push(prose([LS([["opening the interview room → ", "muted"], [LINKS.interview, "accent"]])])),
        { type: "openUrl", url: LINKS.interview },
      ];
    case "reload":
      return [{ type: "reload" }];
    default:
      return [push(prose([LS([[`unknown command: /${name}`, "red"], [". /help lists everything.", "muted"]])]))];
  }
}
