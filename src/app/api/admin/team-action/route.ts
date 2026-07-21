import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getStage, getTeamById, getOrCreateProgress, logEvent } from "@/lib/game/queries";
import { advanceTeam } from "@/lib/game/attempts";
import { isStageKey, previousPhase } from "@/lib/game/stateMachine";
import { generateTeamToken } from "@/lib/crypto";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import type { StageKey } from "@/lib/types";

const bodySchema = z.object({
  teamId: z.string().uuid(),
  action: z.enum([
    "start",
    "pause",
    "resume",
    "unlock_stage",
    "rollback_stage",
    "reset_attempts",
    "clear_lockout",
    "complete_stage",
    "reset_team",
    "mark_escaped",
    "declare_winner",
    "invalidate_winner",
    "regenerate_token",
    "toggle_access",
  ]),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return { error: "invalid_request" };
    const { teamId, action } = parsed.data;

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const team = await getTeamById(teamId);
    if (!team || team.game_id !== game.id) return { error: "team_not_found" };

    const db = supabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const log = (eventType: string, payload: Record<string, unknown> = {}) =>
      logEvent({ gameId: game.id, teamId: team.id, adminUserId: adminUser, eventType, payload });

    switch (action) {
      case "start": {
        if (team.status === "in_game") return { error: "already_started" };
        await db
          .from("teams")
          .update({
            status: "in_game",
            started_at: team.started_at ?? nowIso,
            paused_at: null,
            updated_at: nowIso,
          })
          .eq("id", team.id);
        const stage = await getStage(game.id, "stage_1_access");
        if (stage) {
          const progress = await getOrCreateProgress(team.id, stage.id);
          if (progress.status === "locked") {
            await db
              .from("team_stage_progress")
              .update({ status: "active", updated_at: nowIso })
              .eq("id", progress.id);
          }
        }
        if (game.status === "setup" || game.status === "ready") {
          await db
            .from("games")
            .update({ status: "in_progress", started_at: game.started_at ?? nowIso, updated_at: nowIso })
            .eq("id", game.id);
        }
        await log("team_started");
        break;
      }
      case "pause": {
        if (team.status !== "in_game" || team.paused_at) return { error: "not_running" };
        await db
          .from("teams")
          .update({ status: "paused", paused_at: nowIso, updated_at: nowIso })
          .eq("id", team.id);
        await log("team_paused");
        break;
      }
      case "resume": {
        if (team.status !== "paused" || !team.paused_at) return { error: "not_paused" };
        const pausedSeconds = Math.floor((now.getTime() - new Date(team.paused_at).getTime()) / 1000);
        await db
          .from("teams")
          .update({
            status: "in_game",
            paused_at: null,
            paused_duration_seconds: team.paused_duration_seconds + pausedSeconds,
            updated_at: nowIso,
          })
          .eq("id", team.id);
        await log("team_resumed", { pausedSeconds });
        break;
      }
      case "complete_stage":
      case "unlock_stage": {
        // Completa manualmente la etapa actual y avanza a la siguiente.
        if (team.current_phase === "escaped") return { error: "already_escaped" };
        const stageKey = team.current_phase as StageKey;
        if (!isStageKey(stageKey)) return { error: "invalid_phase" };
        const stage = await getStage(game.id, stageKey);
        if (stage) {
          const progress = await getOrCreateProgress(team.id, stage.id);
          await db
            .from("team_stage_progress")
            .update({ status: "completed", completed_at: nowIso, locked_until: null, updated_at: nowIso })
            .eq("id", progress.id);
        }
        await log("manual_advance", { stage: stageKey });
        await advanceTeam(game, team, stageKey);
        break;
      }
      case "rollback_stage": {
        const prev = previousPhase(team.current_phase);
        if (!prev) return { error: "already_first_stage" };
        const stage = await getStage(game.id, prev);
        if (stage) {
          const progress = await getOrCreateProgress(team.id, stage.id);
          await db
            .from("team_stage_progress")
            .update({
              status: "active",
              completed_at: null,
              locked_until: null,
              attempts_in_window: 0,
              updated_at: nowIso,
            })
            .eq("id", progress.id);
        }
        await db
          .from("teams")
          .update({
            current_phase: prev,
            status: team.status === "escaped" ? "in_game" : team.status,
            escaped_at: null,
            finishing_position: null,
            updated_at: nowIso,
          })
          .eq("id", team.id);
        if (game.winner_team_id === team.id) {
          await db.from("games").update({ winner_team_id: null, updated_at: nowIso }).eq("id", game.id);
        }
        await log("manual_rollback", { to: prev });
        break;
      }
      case "reset_attempts":
      case "clear_lockout": {
        const stageKey = team.current_phase;
        if (isStageKey(stageKey)) {
          const stage = await getStage(game.id, stageKey);
          if (stage) {
            await db
              .from("team_stage_progress")
              .update({ attempts_in_window: 0, locked_until: null, updated_at: nowIso })
              .eq("team_id", team.id)
              .eq("stage_id", stage.id);
          }
        }
        await log(action === "reset_attempts" ? "attempts_reset" : "lockout_cleared", {
          stage: stageKey,
        });
        break;
      }
      case "reset_team": {
        // Reinicio completo: progreso, intentos, credenciales, cronómetro.
        await db.from("team_stage_progress").delete().eq("team_id", team.id);
        await db.from("participant_credentials_found").delete().eq("team_id", team.id);
        await db.from("code_attempts").delete().eq("team_id", team.id);
        await db
          .from("teams")
          .update({
            status: "ready",
            current_phase: "stage_1_access",
            started_at: null,
            paused_at: null,
            paused_duration_seconds: 0,
            escaped_at: null,
            finishing_position: null,
            updated_at: nowIso,
          })
          .eq("id", team.id);
        if (game.winner_team_id === team.id) {
          await db.from("games").update({ winner_team_id: null, updated_at: nowIso }).eq("id", game.id);
        }
        await log("team_reset");
        break;
      }
      case "mark_escaped": {
        if (team.current_phase === "escaped") return { error: "already_escaped" };
        await log("manual_escape");
        await advanceTeam(game, team, "final_escape");
        break;
      }
      case "declare_winner": {
        await db.from("games").update({ winner_team_id: team.id, updated_at: nowIso }).eq("id", game.id);
        await log("winner_assigned", { automatic: false });
        break;
      }
      case "invalidate_winner": {
        if (game.winner_team_id !== team.id) return { error: "not_winner" };
        await db.from("games").update({ winner_team_id: null, updated_at: nowIso }).eq("id", game.id);
        await log("winner_invalidated");
        break;
      }
      case "regenerate_token": {
        await db
          .from("teams")
          .update({ access_token: generateTeamToken(), updated_at: nowIso })
          .eq("id", team.id);
        await log("token_regenerated");
        break;
      }
      case "toggle_access": {
        await db
          .from("teams")
          .update({ access_enabled: !team.access_enabled, updated_at: nowIso })
          .eq("id", team.id);
        await log("access_toggled", { enabled: !team.access_enabled });
        break;
      }
    }

    await notifyTeam(team.access_token);
    await notifyAdmin();
    return { ok: true };
  });
}
