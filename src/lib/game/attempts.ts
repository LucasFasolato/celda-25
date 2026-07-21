import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCode } from "@/lib/crypto";
import { normalizeCode } from "@/lib/normalize";
import { nextPhase } from "./stateMachine";
import { getOrCreateProgress, getStage, logEvent } from "./queries";
import { sendStage3Batch } from "@/lib/messaging/batch";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import type { GameRow, StageKey, TeamRow } from "@/lib/types";

export interface AttemptResult {
  outcome: "correct" | "incorrect" | "locked" | "not_active" | "credentials_missing";
  attemptsRemaining?: number;
  lockedUntil?: string;
  newPhase?: string;
  escaped?: { position: number };
}

/**
 * Valida un intento de código de etapa. Toda la lógica de intentos, ventanas
 * y bloqueos vive acá; el frontend nunca conoce el código correcto.
 */
export async function submitStageCode(
  game: GameRow,
  team: TeamRow,
  stageKey: StageKey,
  rawCode: string,
  clientFingerprint?: string
): Promise<AttemptResult> {
  const db = supabaseAdmin();

  if (team.current_phase !== stageKey || team.status !== "in_game") {
    return { outcome: "not_active" };
  }

  const stage = await getStage(game.id, stageKey);
  if (!stage) return { outcome: "not_active" };

  // Etapa 3: exige 6/6 credenciales antes de habilitar el código.
  if (stageKey === "stage_3_identity") {
    const { count } = await db
      .from("participant_credentials_found")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id);
    const { count: totalParticipants } = await db
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id);
    if ((count ?? 0) < (totalParticipants ?? 6)) {
      return { outcome: "credentials_missing" };
    }
  }

  const maxAttempts = stage.max_attempts ?? game.max_attempts;
  const lockoutMinutes = stage.lockout_minutes ?? game.lockout_minutes;
  let progress = await getOrCreateProgress(team.id, stage.id);
  const now = new Date();

  // ¿Bloqueado?
  if (progress.locked_until) {
    const lockedUntil = new Date(progress.locked_until);
    if (lockedUntil > now) {
      return { outcome: "locked", lockedUntil: progress.locked_until };
    }
    // Bloqueo vencido: nueva ventana de intentos.
    const { data } = await db
      .from("team_stage_progress")
      .update({ locked_until: null, attempts_in_window: 0, updated_at: now.toISOString() })
      .eq("id", progress.id)
      .select("*")
      .single();
    if (data) progress = data;
    await logEvent({ gameId: game.id, teamId: team.id, eventType: "lockout_ended", payload: { stage: stageKey } });
  }

  const normalized = normalizeCode(rawCode);
  const correct = verifyCode(rawCode, stage.correct_code_hash);

  await db.from("code_attempts").insert({
    team_id: team.id,
    stage_id: stage.id,
    submitted_value_normalized: normalized,
    was_correct: correct,
    client_fingerprint: clientFingerprint ?? null,
  });
  await logEvent({
    gameId: game.id,
    teamId: team.id,
    eventType: correct ? "code_correct" : "code_incorrect",
    payload: { stage: stageKey, attempt: normalized.slice(0, 64) },
  });

  if (!correct) {
    const attemptsInWindow = progress.attempts_in_window + 1;
    const update: Record<string, unknown> = {
      attempts_in_window: attemptsInWindow,
      total_attempts: progress.total_attempts + 1,
      updated_at: now.toISOString(),
    };
    let lockedUntil: string | undefined;
    if (attemptsInWindow >= maxAttempts) {
      lockedUntil = new Date(now.getTime() + lockoutMinutes * 60_000).toISOString();
      update.locked_until = lockedUntil;
      await logEvent({
        gameId: game.id,
        teamId: team.id,
        eventType: "lockout_started",
        payload: { stage: stageKey, minutes: lockoutMinutes },
      });
    }
    await db.from("team_stage_progress").update(update).eq("id", progress.id);
    await notifyTeam(team.access_token);
    await notifyAdmin();
    return lockedUntil
      ? { outcome: "locked", lockedUntil }
      : { outcome: "incorrect", attemptsRemaining: maxAttempts - attemptsInWindow };
  }

  // Correcto: completar etapa y avanzar.
  await db
    .from("team_stage_progress")
    .update({
      status: "completed",
      total_attempts: progress.total_attempts + 1,
      completed_at: now.toISOString(),
      locked_until: null,
      updated_at: now.toISOString(),
    })
    .eq("id", progress.id);

  const result = await advanceTeam(game, team, stageKey);
  await notifyTeam(team.access_token);
  await notifyAdmin();
  return { outcome: "correct", ...result };
}

/**
 * Avanza el equipo a la fase siguiente y ejecuta efectos:
 * - Etapa 2 completada → tanda de WhatsApp.
 * - Final completada → fuga, posición y ganador automático.
 */
export async function advanceTeam(
  game: GameRow,
  team: TeamRow,
  completedStage: StageKey
): Promise<Pick<AttemptResult, "newPhase" | "escaped">> {
  const db = supabaseAdmin();
  const phase = nextPhase(completedStage);
  const now = new Date().toISOString();

  await logEvent({
    gameId: game.id,
    teamId: team.id,
    eventType: "stage_completed",
    payload: { stage: completedStage },
  });

  if (phase !== "escaped") {
    await db
      .from("teams")
      .update({ current_phase: phase, updated_at: now })
      .eq("id", team.id);
    // Activar la fila de progreso de la nueva etapa.
    const next = await getStage(game.id, phase);
    if (next) {
      const progress = await getOrCreateProgress(team.id, next.id);
      if (progress.status === "locked") {
        await db
          .from("team_stage_progress")
          .update({ status: "active", updated_at: now })
          .eq("id", progress.id);
      }
    }
    if (completedStage === "stage_2_evidence") {
      // Tanda de mensajes: no bloquear la respuesta si algo falla.
      try {
        await sendStage3Batch(game, { ...team, current_phase: phase });
      } catch (err) {
        console.error("Fallo en tanda de mensajes", err);
      }
    }
    return { newPhase: phase };
  }

  // Fuga completada.
  const { count: escapedBefore } = await db
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("game_id", game.id)
    .eq("status", "escaped");
  const position = (escapedBefore ?? 0) + 1;

  await db
    .from("teams")
    .update({
      current_phase: "escaped",
      status: "escaped",
      escaped_at: now,
      finishing_position: position,
      updated_at: now,
    })
    .eq("id", team.id);

  await logEvent({
    gameId: game.id,
    teamId: team.id,
    eventType: "escape_completed",
    payload: { position },
  });

  if (position === 1 && !game.winner_team_id) {
    await db
      .from("games")
      .update({ winner_team_id: team.id, updated_at: now })
      .eq("id", game.id);
    await logEvent({
      gameId: game.id,
      teamId: team.id,
      eventType: "winner_assigned",
      payload: { automatic: true },
    });
  }

  return { newPhase: "escaped", escaped: { position } };
}
