import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getTeamByToken, logEvent } from "@/lib/game/queries";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
});

/** Crea una solicitud de pista para la etapa actual del equipo. */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { token } = parsed.data;

  if (!rateLimit(`hint:${token}`, 6, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const team = await getTeamByToken(token);
  if (!team || !team.access_enabled) {
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }
  const game = await getGame();
  if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });
  if (!game.hints_enabled) {
    return NextResponse.json({ error: "hints_disabled" }, { status: 403 });
  }

  const db = supabaseAdmin();
  // Una sola solicitud pendiente por equipo.
  const { data: pending } = await db
    .from("hint_requests")
    .select("id")
    .eq("team_id", team.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ outcome: "already_pending" });
  }

  await db.from("hint_requests").insert({
    team_id: team.id,
    stage_key: team.current_phase,
  });
  await logEvent({
    gameId: game.id,
    teamId: team.id,
    eventType: "hint_requested",
    payload: { stage: team.current_phase },
  });

  await notifyTeam(team.access_token);
  await notifyAdmin();
  return NextResponse.json({ outcome: "created" });
}
