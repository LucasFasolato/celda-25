import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, logEvent } from "@/lib/game/queries";
import { notifyAdmin } from "@/lib/realtime";

/** Verificación del webhook (Meta hace GET con hub.challenge). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === env.whatsapp.webhookVerifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  errors?: { title?: string; message?: string }[];
}

/** Estados de mensajes (sent/delivered/read/failed) enviados por Meta. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    entry?: { changes?: { value?: { statuses?: WhatsAppStatus[] } }[] }[];
  } | null;
  // Siempre responder 200 rápido: Meta reintenta ante errores.
  if (!body?.entry) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  const game = await getGame();

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const { data: message } = await db
          .from("outbound_messages")
          .select("id, team_id, participant_id, status")
          .eq("external_message_id", status.id)
          .maybeSingle();
        if (!message) continue;

        const nowIso = status.timestamp
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : new Date().toISOString();
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

        // No degradar estados (read no vuelve a delivered).
        const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
        if (status.status === "failed") {
          update.status = "failed";
          update.error_message =
            status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? "Fallo reportado por Meta";
        } else if ((rank[status.status] ?? 0) > (rank[message.status as string] ?? 0)) {
          update.status = status.status;
          if (status.status === "delivered") update.delivered_at = nowIso;
          if (status.status === "read") update.read_at = nowIso;
        }

        await db.from("outbound_messages").update(update).eq("id", message.id);
        if (game) {
          await logEvent({
            gameId: game.id,
            teamId: message.team_id,
            participantId: message.participant_id,
            eventType: `message_${status.status}`,
            payload: { externalId: status.id },
          });
        }
      }
    }
  }

  await notifyAdmin();
  return NextResponse.json({ ok: true });
}
