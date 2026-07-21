import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, logEvent } from "@/lib/game/queries";
import { dispatchMessage } from "@/lib/messaging/batch";
import { waMeLink } from "@/lib/messaging";
import { notifyAdmin } from "@/lib/realtime";
import type { OutboundMessageRow, ParticipantRow } from "@/lib/types";

const bodySchema = z.discriminatedUnion("action", [
  // Envía por primera vez un mensaje a un jugador (fuera de la tanda automática).
  z.object({
    action: z.literal("send"),
    participantId: z.string().uuid(),
    body: z.string().min(1).max(4000).optional(),
  }),
  // Reenvía un mensaje existente (crea nueva versión si se edita el texto).
  z.object({
    action: z.literal("resend"),
    messageId: z.string().uuid(),
    body: z.string().min(1).max(4000).optional(),
  }),
  // Edita un mensaje aún no enviado.
  z.object({
    action: z.literal("edit"),
    messageId: z.string().uuid(),
    body: z.string().min(1).max(4000),
  }),
  // Devuelve el link wa.me para envío manual.
  z.object({ action: z.literal("wa_link"), messageId: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return { error: "invalid_request" };
    const input = parsed.data;

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const db = supabaseAdmin();

    const getParticipant = async (id: string): Promise<ParticipantRow | null> => {
      const { data } = await db.from("participants").select("*").eq("id", id).maybeSingle();
      return data;
    };

    if (input.action === "send") {
      const participant = await getParticipant(input.participantId);
      if (!participant) return { error: "participant_not_found" };
      const { data: message, error } = await db
        .from("outbound_messages")
        .insert({
          participant_id: participant.id,
          team_id: participant.team_id,
          provider: game.messaging_mode,
          message_body: input.body ?? participant.private_message,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;
      await logEvent({
        gameId: game.id,
        teamId: participant.team_id,
        participantId: participant.id,
        adminUserId: adminUser,
        eventType: "message_created",
        payload: { manual: true },
      });
      const updated = await dispatchMessage(game, message as OutboundMessageRow, participant);
      await notifyAdmin();
      return { ok: true, message: updated };
    }

    const { data: existing } = await db
      .from("outbound_messages")
      .select("*")
      .eq("id", input.messageId)
      .maybeSingle();
    if (!existing) return { error: "message_not_found" };
    const message = existing as OutboundMessageRow;
    const participant = await getParticipant(message.participant_id);
    if (!participant) return { error: "participant_not_found" };

    if (input.action === "wa_link") {
      return { ok: true, link: waMeLink(participant.phone_e164, message.message_body) };
    }

    if (input.action === "edit") {
      if (message.sent_at || !["pending", "failed"].includes(message.status)) {
        return { error: "already_sent_use_resend" };
      }
      const { data: updated } = await db
        .from("outbound_messages")
        .update({
          message_body: input.body,
          message_version: message.message_version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", message.id)
        .select("*")
        .single();
      await notifyAdmin();
      return { ok: true, message: updated };
    }

    // resend: siempre crea un registro nuevo (historial de versiones intacto).
    const { data: resend, error: resendError } = await db
      .from("outbound_messages")
      .insert({
        participant_id: participant.id,
        team_id: message.team_id,
        stage_key: message.stage_key,
        provider: game.messaging_mode,
        message_body: input.body ?? message.message_body,
        message_version: input.body ? message.message_version + 1 : message.message_version,
        is_resend: true,
        status: "pending",
      })
      .select("*")
      .single();
    if (resendError) throw resendError;
    await logEvent({
      gameId: game.id,
      teamId: message.team_id,
      participantId: participant.id,
      adminUserId: adminUser,
      eventType: "message_resent",
      payload: { originalMessageId: message.id, edited: Boolean(input.body) },
    });
    const dispatched = await dispatchMessage(game, resend as OutboundMessageRow, participant);
    await notifyAdmin();
    return { ok: true, message: dispatched };
  });
}
