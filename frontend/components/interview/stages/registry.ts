import type { ComponentType } from "react";
import type { StageId } from "@/lib/interview/types";
import { PreflightStage } from "./preflight-stage";

/** Stage id to screen. Partial on purpose: an id with no entry falls back to
 * the placeholder, so rounds can land one at a time without touching the room
 * shell. Heavier stages (editor, whiteboard) should enter here via
 * next/dynamic so they stay out of the pre-flight bundle. */
export const STAGE_COMPONENTS: Partial<Record<StageId, ComponentType>> = {
  preflight: PreflightStage,
};
