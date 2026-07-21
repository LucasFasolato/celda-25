import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/messaging";
import { logEvent } from "@/lib/game/queries";
import { notifyAdmin } from "@/lib/realtime";
import type { GameRow, OutboundMessageRow, ParticipantRow, TeamRow } from "@/lib/types";

/**
 * Tanda automática de mensajes al validar la Etapa 2.
 * Idempotente: batch_key único por equipo+etapa; reejecutar no duplica envíos.
 */
export async function sendStage3Batch(game: GameRow, team: TeamRow): Promise<void> {
  const db = supabaseAdmin();
  const batchKey = `stage3:${team.id}`;

  const { data: participants, error } = await db
    .from("participants")
    .select("*")
    .eq("team_id", team.id)
    .eq("message_enabled", true)
    .order("display_order");
  if (error) throw error;

  for (const participant of (participants ?? []) as ParticipantRow[]) {
    // Insert idempotente: si ya existe un mensaje de esta tanda para este
    // jugador, el índice único lo rechaza y se saltea.
    const { data: message, error: insertError } = await db
      .from("outbound_messages")
      .insert({
        participant_id: participant.id,
        team_id: team.id,
        stage_key: "stage_3_identity",
        provider: game.messaging_mode,
        message_body: participant.private_message || defaultMessage(participant, team),
        batch_key: batchKey,
        status: "pending",
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") continue; // ya enviado en una tanda previa
      console.error("Error creando mensaje", insertError.message);
      continue;
    }
    if (message) {
      await dispatchMessage(game, message as OutboundMessageRow, participant);
    }
  }
  await notifyAdmin();
}

/** Envía (o reenvía) un mensaje ya persistido y actualiza su estado. */
export async function dispatchMessage(
  game: GameRow,
  message: OutboundMessageRow,
  participant: ParticipantRow
): Promise<OutboundMessageRow> {
  const db = supabaseAdmin();
  const provider = getProvider(game.messaging_mode);
  const result = await provider.sendMessage({
    to: participant.phone_e164,
    body: message.message_body,
  });

  const update = {
    provider: provider.name,
    status: result.status,
    external_message_id: result.externalMessageId ?? null,
    error_message: result.ok ? null : (result.error ?? "Error desconocido"),
    sent_at: result.ok ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data: updated } = await db
    .from("outbound_messages")
    .update(update)
    .eq("id", message.id)
    .select("*")
    .single();

  await logEvent({
    gameId: game.id,
    teamId: message.team_id,
    participantId: participant.id,
    eventType: result.ok ? "message_sent" : "message_failed",
    payload: {
      provider: provider.name,
      status: result.status,
      error: result.error ?? null,
      resend: message.is_resend,
    },
  });

  return (updated ?? { ...message, ...update }) as OutboundMessageRow;
}

function defaultMessage(participant: ParticipantRow, team: TeamRow): string {
  return [
    `CELDA 25 – CÁRCEL DEL QUINCHO`,
    ``,
    `${participant.name}, este mensaje es CONFIDENCIAL. No lo muestres a nadie.`,
    ``,
    participant.role ? `Tu identidad: ${participant.role}.` : null,
    participant.clue_location ? `Tu credencial está escondida: ${participant.clue_location}.` : null,
    participant.private_mission ? `Tu misión: ${participant.private_mission}.` : null,
    ``,
    `Encontrá tu credencial y cargá su código en la terminal del equipo ${team.name}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
