import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, getTeamById, logEvent } from "@/lib/game/queries";
import { dispatchMessage } from "@/lib/messaging/batch";
import { notifyAdmin, notifyTeam } from "@/lib/realtime";
import type { OutboundMessageRow, ParticipantRow } from "@/lib/types";

const bodySchema = z.object({
  hintId: z.string().uuid(),
  action: z.enum(["respond_screen", "respond_whatsapp", "dismiss"]),
  responseText: z.string().max(2000).optional(),
  participantId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return { error: "invalid_request" };
    const { hintId, action, responseText, participantId } = parsed.data;

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const db = supabaseAdmin();

    const { data: hint } = await db.from("hint_requests").select("*").eq("id", hintId).maybeSingle();
    if (!hint) return { error: "hint_not_found" };

    const nowIso = new Date().toISOString();

    if (action === "dismiss") {
      await db
        .from("hint_requests")
        .update({ status: "dismissed", responded_at: nowIso, responded_by: adminUser })
        .eq("id", hintId);
    } else {
      if (!responseText) return { error: "response_text_required" };
      await db
        .from("hint_requests")
        .update({
          status: "responded",
          response_text: responseText,
          responded_at: nowIso,
          responded_by: adminUser,
        })
        .eq("id", hintId);

      if (action === "respond_whatsapp") {
        if (!participantId) return { error: "participant_required" };
        const { data: participant } = await db
          .from("participants")
          .select("*")
          .eq("id", participantId)
          .maybeSingle();
        if (!participant) return { error: "participant_not_found" };
        const { data: message, error } = await db
          .from("outbound_messages")
          .insert({
            participant_id: participant.id,
            team_id: hint.team_id,
            stage_key: hint.stage_key,
            provider: game.messaging_mode,
            message_body: `CELDA 25 – PISTA\n\n${responseText}`,
            status: "pending",
          })
          .select("*")
          .single();
        if (error) throw error;
        await dispatchMessage(game, message as OutboundMessageRow, participant as ParticipantRow);
      }
    }

    await logEvent({
      gameId: game.id,
      teamId: hint.team_id,
      adminUserId: adminUser,
      eventType: action === "dismiss" ? "hint_dismissed" : "hint_responded",
      payload: { stage: hint.stage_key, via: action },
    });

    const team = await getTeamById(hint.team_id);
    if (team) await notifyTeam(team.access_token);
    await notifyAdmin();
    return { ok: true };
  });
}
