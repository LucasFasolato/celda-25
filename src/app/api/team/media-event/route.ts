import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGame, getTeamByToken, logEvent } from "@/lib/game/queries";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
  kind: z.enum(["video_played", "audio_played", "final_audio_played"]),
});

/** Registra la primera reproducción de video/audio (auditoría). */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { token, kind } = parsed.data;

  if (!rateLimit(`media:${token}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const team = await getTeamByToken(token);
  if (!team) return NextResponse.json({ error: "access_denied" }, { status: 403 });
  const game = await getGame();
  if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });

  await logEvent({ gameId: game.id, teamId: team.id, eventType: kind });
  return NextResponse.json({ ok: true });
}
