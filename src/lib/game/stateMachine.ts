import { STAGE_ORDER, type StageKey, type TeamPhase } from "@/lib/types";

/** Etapa siguiente a una dada, o "escaped" si era la final. */
export function nextPhase(current: StageKey): TeamPhase {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === STAGE_ORDER.length - 1) return "escaped";
  return STAGE_ORDER[idx + 1];
}

/** Etapa anterior (para retroceso manual). Null si es la primera. */
export function previousPhase(current: TeamPhase): StageKey | null {
  if (current === "escaped") return "final_escape";
  const idx = STAGE_ORDER.indexOf(current);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

export function isStageKey(value: string): value is StageKey {
  return (STAGE_ORDER as string[]).includes(value);
}

/** true si `stage` ya quedó atrás respecto de la fase actual del equipo. */
export function isStageCompleted(stage: StageKey, phase: TeamPhase): boolean {
  if (phase === "escaped") return true;
  return STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(phase);
}

export function isStageActive(stage: StageKey, phase: TeamPhase): boolean {
  return stage === phase;
}
