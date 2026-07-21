import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGame, getTeamByToken, logEvent } from "@/lib/game/queries";
import { buildTeamState } from "@/lib/game/teamState";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
  firstLoad: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { token, firstLoad } = parsed.data;

  if (!rateLimit(`team-state:${token}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const team = await getTeamByToken(token);
  if (!team || !team.access_enabled) {
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }
  const game = await getGame();
  if (!game) {
    return NextResponse.json({ error: "no_game" }, { status: 404 });
  }

  if (firstLoad) {
    await logEvent({
      gameId: game.id,
      teamId: team.id,
      eventType: "page_opened",
      payload: { userAgent: req.headers.get("user-agent")?.slice(0, 120) ?? null },
    });
  }

  const state = await buildTeamState(game, team);
  return NextResponse.json(state);
}
