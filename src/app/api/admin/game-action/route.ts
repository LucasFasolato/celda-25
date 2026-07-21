import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getStage, getOrCreateProgress, logEvent } from "@/lib/game/queries";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import type { TeamRow } from "@/lib/types";

const bodySchema = z.object({
  action: z.enum(["start_all", "reset_all"]),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return { error: "invalid_request" };

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const db = supabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: teamsData } = await db.from("teams").select("*").eq("game_id", game.id);
    const teams = (teamsData ?? []) as TeamRow[];

    if (parsed.data.action === "start_all") {
      for (const team of teams) {
        if (team.status === "in_game") continue;
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
        await logEvent({
          gameId: game.id,
          teamId: team.id,
          adminUserId: adminUser,
          eventType: "team_started",
        });
      }
      await db
        .from("games")
        .update({ status: "in_progress", started_at: game.started_at ?? nowIso, updated_at: nowIso })
        .eq("id", game.id);
      await logEvent({ gameId: game.id, adminUserId: adminUser, eventType: "game_started" });
    } else {
      // reset_all: reinicio completo de la partida (destructivo, confirmado en UI).
      const teamIds = teams.map((t) => t.id);
      if (teamIds.length) {
        await db.from("team_stage_progress").delete().in("team_id", teamIds);
        await db.from("participant_credentials_found").delete().in("team_id", teamIds);
        await db.from("code_attempts").delete().in("team_id", teamIds);
        await db.from("outbound_messages").delete().in("team_id", teamIds);
        await db.from("hint_requests").delete().in("team_id", teamIds);
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
          .in("id", teamIds);
      }
      await db
        .from("games")
        .update({
          status: "ready",
          started_at: null,
          completed_at: null,
          winner_team_id: null,
          updated_at: nowIso,
        })
        .eq("id", game.id);
      await logEvent({ gameId: game.id, adminUserId: adminUser, eventType: "game_reset" });
    }

    for (const team of teams) await notifyTeam(team.access_token);
    await notifyAdmin();
    return { ok: true };
  });
}
