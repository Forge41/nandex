import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { StageId } from "@/lib/interview/types";
import { PreflightStage } from "./preflight-stage";
import { ResumePlanStage } from "./resume-plan-stage";
import { BehavioralStage } from "./behavioral-stage";
import { QuizStage } from "./quiz-stage";
import { QaStage } from "./qa-stage";
import { WrapStage } from "./wrap-stage";

/** CodeMirror and its language grammars are the heaviest thing in the app and
 * only three rounds need them, so those stages load on arrival rather than
 * riding along in the pre-flight bundle. */
const CodingStage = dynamic(() => import("./coding-stage").then((m) => m.CodingStage));
const SqlStage = dynamic(() => import("./sql-stage").then((m) => m.SqlStage));
const DebugStage = dynamic(() => import("./debug-stage").then((m) => m.DebugStage));
const DesignStage = dynamic(() => import("./design-stage").then((m) => m.DesignStage));

/** Stage id to screen. Partial on purpose: an id with no entry falls back to
 * the placeholder, so a round can ship without touching the room shell. */
export const STAGE_COMPONENTS: Partial<Record<StageId, ComponentType>> = {
  preflight: PreflightStage,
  resume: ResumePlanStage,
  behavioral: BehavioralStage,
  coding: CodingStage,
  sql: SqlStage,
  debug: DebugStage,
  design: DesignStage,
  quiz: QuizStage,
  qa: QaStage,
  wrap: WrapStage,
};
