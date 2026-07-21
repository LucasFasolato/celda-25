import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getTeamByToken, logEvent } from "@/lib/game/queries";
import { verifyCode } from "@/lib/crypto";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import { rateLimit } from "@/lib/rateLimit";
import type { ParticipantRow } from "@/lib/types";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
  code: z.string().min(1).max(120),
  fingerprint: z.string().max(120).optional(),
});

/**
 * Valida un código de credencial (Etapa 3). Un solo campo: el backend
 * identifica a qué jugador pertenece y lo marca como localizado.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { token, code, fingerprint } = parsed.data;

  if (!rateLimit(`credential:${token}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const team = await getTeamByToken(token);
  if (!team || !team.access_enabled) {
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }
  if (team.current_phase !== "stage_3_identity" || team.status !== "in_game") {
    return NextResponse.json({ outcome: "not_active" });
  }
  const game = await getGame();
  if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: participants } = await db
    .from("participants")
    .select("*")
    .eq("team_id", team.id);

  const match = ((participants ?? []) as ParticipantRow[]).find((p) =>
    verifyCode(code, p.credential_code_hash)
  );

  if (!match) {
    await logEvent({
      gameId: game.id,
      teamId: team.id,
      eventType: "credential_invalid",
      payload: {},
    });
    return NextResponse.json({ outcome: "invalid" });
  }

  // Insert con unique(team, participant): reutilizar un código no duplica.
  const { error: insertError } = await db.from("participant_credentials_found").insert({
    team_id: team.id,
    participant_id: match.id,
    entered_from_session: fingerprint ?? null,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ outcome: "already_used", playerName: match.name });
    }
    throw insertError;
  }

  await logEvent({
    gameId: game.id,
    teamId: team.id,
    participantId: match.id,
    eventType: "credential_validated",
    payload: { player: match.name },
  });

  const { count } = await db
    .from("participant_credentials_found")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  await notifyTeam(team.access_token);
  await notifyAdmin();

  return NextResponse.json({
    outcome: "found",
    playerName: match.name,
    found: count ?? 0,
    total: (participants ?? []).length,
  });
}
