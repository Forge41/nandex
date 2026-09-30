export type Source = { id: string; doc: string; title: string; text: string };

export type AnswerSeg = { t: string; code?: boolean } | { c: string };
export type AnswerPara = AnswerSeg[];

export type Answer = { keys: string[]; paras: AnswerPara[] };

/** `live` is what promotes a project onto the Projects shelf; the rest stay in `!ls projects/`. */
export type Project = {
  name: string;
  title: string;
  year: string;
  one: string;
  src: string;
  stack: string[];
  label?: string;
  live?: { url: string; host: string; shot: string };
  repo?: string;
  did?: string[];
};

export type Role = {
  id: string;
  role: string;
  org: string;
  client?: string;
  when: string;
  current?: boolean;
  one: string;
  src: string;
  stack: string[];
  did: string[];
};

export type StackGroup = { label: string; items: string[] };

export type Commit = { hash: string; date: string; msg: string; tag?: string };

export type Skills = {
  languages: string[];
  backend: string[];
  genai: string[];
  rag: string[];
  agentic: string[];
  voice: string[];
  eval_infra: string[];
};
