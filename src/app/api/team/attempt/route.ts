import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGame, getTeamByToken } from "@/lib/game/queries";
import { submitStageCode } from "@/lib/game/attempts";
import { isStageKey } from "@/lib/game/stateMachine";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  token: z.string().min(16).max(128),
  stageKey: z.string(),
  code: z.string().min(1).max(200),
  fingerprint: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { token, stageKey, code, fingerprint } = parsed.data;

  if (!rateLimit(`attempt:${token}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!isStageKey(stageKey)) {
    return NextResponse.json({ error: "invalid_stage" }, { status: 400 });
  }

  const team = await getTeamByToken(token);
  if (!team || !team.access_enabled) {
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }
  const game = await getGame();
  if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });

  const result = await submitStageCode(game, team, stageKey, code, fingerprint);
  return NextResponse.json(result);
}
