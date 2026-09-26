export type Source = { id: string; doc: string; title: string; text: string };

export type AnswerSeg = { t: string; code?: boolean } | { c: string };
export type AnswerPara = AnswerSeg[];

export type Answer = { keys: string[]; paras: AnswerPara[] };

export type Project = { name: string; title: string; year: string; one: string; src: string; stack: string[] };

export type Commit = { hash: string; date: string; msg: string; tag?: string };

export type Skills = {
  languages: string[];
  backend: string[];
  genai: string[];
  rag: string[];
  agentic: string[];
  voice: string[];
  eval_infra: string[];
  finetune: string[];
};
