import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getTeamById, logEvent } from "@/lib/game/queries";
import { notifyTeam } from "@/lib/realtime";
import type { TeamRow } from "@/lib/types";

const bodySchema = z.object({
  action: z.enum(["play_final_audio", "stop_audio"]),
  target: z.union([z.literal("all"), z.string().uuid()]),
});

/**
 * Control remoto del audio final: emite un evento realtime a los dispositivos
 * del/los equipo(s); el navegador conectado al parlante lo reproduce.
 */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return { error: "invalid_request" };
    const { action, target } = parsed.data;

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const db = supabaseAdmin();

    let teams: TeamRow[] = [];
    if (target === "all") {
      const { data } = await db.from("teams").select("*").eq("game_id", game.id);
      teams = (data ?? []) as TeamRow[];
    } else {
      const team = await getTeamById(target);
      if (!team) return { error: "team_not_found" };
      teams = [team];
    }

    for (const team of teams) {
      await notifyTeam(team.access_token, action);
    }
    await logEvent({
      gameId: game.id,
      adminUserId: adminUser,
      eventType: action,
      payload: { target },
    });
    return { ok: true };
  });
}
