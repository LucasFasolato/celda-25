import { env } from "@/lib/env";
import { hmacSign } from "@/lib/crypto";

/**
 * Broadcast server→clientes vía el endpoint REST de Supabase Realtime.
 * Los payloads nunca llevan datos del juego: son pings de "refresh" y los
 * clientes refetchean por la API autenticada.
 */
async function broadcast(topic: string, event: string, payload: Record<string, unknown> = {}) {
  try {
    await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
  } catch {
    // Realtime es best-effort: los clientes tienen polling de respaldo.
  }
}

/** Canal por equipo, no adivinable porque incluye el token. */
export function notifyTeam(teamToken: string, event = "refresh") {
  return broadcast(`team:${teamToken}`, event);
}

/** Canal admin, derivado del secreto de sesión (no adivinable sin el secreto). */
export function adminTopic(): string {
  return `admin:${hmacSign("admin-channel", env.sessionSecret).slice(0, 24)}`;
}

export function notifyAdmin(event = "refresh") {
  return broadcast(adminTopic(), event);
}
