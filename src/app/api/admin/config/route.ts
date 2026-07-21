import { NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureGame } from "@/lib/game/bootstrap";
import { hashCode } from "@/lib/crypto";
import { normalizePhone } from "@/lib/normalize";
import { logEvent } from "@/lib/game/queries";
import { notifyAdmin } from "@/lib/realtime";

const configSchema = z.object({
  game: z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      maxAttempts: z.number().int().min(1).max(20).optional(),
      lockoutMinutes: z.number().int().min(1).max(60).optional(),
      messagingMode: z.enum(["mock", "whatsapp"]).optional(),
      hintsEnabled: z.boolean().optional(),
    })
    .optional(),
  stageCodes: z
    .array(
      z.object({
        stageKey: z.enum(["stage_1_access", "stage_2_evidence", "stage_3_identity", "final_escape"]),
        code: z.string().min(1).max(200),
      })
    )
    .optional(),
  teams: z
    .array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(100) }))
    .optional(),
  participants: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        phone: z.string().max(30).optional(),
        role: z.string().max(200).optional(),
        credentialCode: z.string().min(1).max(120).optional(),
        privateMessage: z.string().max(4000).optional(),
        privateMission: z.string().max(2000).optional(),
        clueLocation: z.string().max(2000).optional(),
        messageEnabled: z.boolean().optional(),
        displayOrder: z.number().int().min(0).max(20).optional(),
      })
    )
    .optional(),
});

/** Actualiza configuración: partida, códigos, equipos y jugadores. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  return withAdmin(async (adminUser) => {
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return { error: "invalid_request", details: parsed.error.flatten() };
    }
    const game = await ensureGame();
    const db = supabaseAdmin();
    const now = new Date().toISOString();
    const input = parsed.data;

    if (input.game) {
      await db
        .from("games")
        .update({
          ...(input.game.name !== undefined && { name: input.game.name }),
          ...(input.game.description !== undefined && { description: input.game.description }),
          ...(input.game.maxAttempts !== undefined && { max_attempts: input.game.maxAttempts }),
          ...(input.game.lockoutMinutes !== undefined && {
            lockout_minutes: input.game.lockoutMinutes,
          }),
          ...(input.game.messagingMode !== undefined && {
            messaging_mode: input.game.messagingMode,
          }),
          ...(input.game.hintsEnabled !== undefined && { hints_enabled: input.game.hintsEnabled }),
          updated_at: now,
        })
        .eq("id", game.id);
    }

    for (const stage of input.stageCodes ?? []) {
      await db
        .from("stages")
        .update({ correct_code_hash: hashCode(stage.code), updated_at: now })
        .eq("game_id", game.id)
        .eq("stage_key", stage.stageKey);
    }

    for (const team of input.teams ?? []) {
      await db
        .from("teams")
        .update({ name: team.name, updated_at: now })
        .eq("id", team.id)
        .eq("game_id", game.id);
    }

    for (const p of input.participants ?? []) {
      await db
        .from("participants")
        .update({
          ...(p.name !== undefined && { name: p.name }),
          ...(p.phone !== undefined && { phone_e164: normalizePhone(p.phone) }),
          ...(p.role !== undefined && { role: p.role }),
          ...(p.credentialCode !== undefined && {
            credential_code_hash: hashCode(p.credentialCode),
          }),
          ...(p.privateMessage !== undefined && { private_message: p.privateMessage }),
          ...(p.privateMission !== undefined && { private_mission: p.privateMission }),
          ...(p.clueLocation !== undefined && { clue_location: p.clueLocation }),
          ...(p.messageEnabled !== undefined && { message_enabled: p.messageEnabled }),
          ...(p.displayOrder !== undefined && { display_order: p.displayOrder }),
          updated_at: now,
        })
        .eq("id", p.id);
    }

    await logEvent({
      gameId: game.id,
      adminUserId: adminUser,
      eventType: "config_updated",
      payload: {
        sections: Object.keys(input),
        stageCodesUpdated: (input.stageCodes ?? []).map((s) => s.stageKey),
      },
    });
    await notifyAdmin();
    return { ok: true };
  });
}
