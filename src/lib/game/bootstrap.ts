import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateTeamToken, hashCode } from "@/lib/crypto";
import { getGame } from "./queries";
import { STAGE_NAMES, STAGE_ORDER, type GameRow } from "@/lib/types";

/**
 * Datos demo (claramente identificados). Los códigos reales se configuran
 * desde el panel admin antes del evento. Ver README para la lista completa.
 */
export const DEMO_STAGE_CODES: Record<string, string> = {
  stage_1_access: "DEMO-ACCESO",
  stage_2_evidence: "DEMO-EVIDENCIA",
  stage_3_identity: "DEMO-IDENTIDAD",
  final_escape: "DEMO-FUGA",
};

/**
 * Crea la partida singleton con estructura completa si no existe:
 * 2 equipos con token propio, 4 etapas y 6 jugadores demo por equipo.
 */
export async function ensureGame(): Promise<GameRow> {
  const existing = await getGame();
  if (existing) return existing;

  const db = supabaseAdmin();
  const { data: game, error } = await db
    .from("games")
    .insert({ status: "setup" })
    .select("*")
    .single();
  if (error) throw error;

  await db.from("stages").insert(
    STAGE_ORDER.map((key, i) => ({
      game_id: game.id,
      stage_key: key,
      name: STAGE_NAMES[key],
      correct_code_hash: hashCode(DEMO_STAGE_CODES[key]),
      display_order: i,
    }))
  );

  for (const [index, teamName] of ["Pabellón A", "Pabellón B"].entries()) {
    const letter = index === 0 ? "A" : "B";
    const { data: team, error: teamError } = await db
      .from("teams")
      .insert({
        game_id: game.id,
        name: teamName,
        access_token: generateTeamToken(),
      })
      .select("*")
      .single();
    if (teamError) throw teamError;

    await db.from("participants").insert(
      Array.from({ length: 6 }, (_, i) => ({
        team_id: team.id,
        name: `[DEMO] Jugador ${letter}${i + 1}`,
        phone_e164: "",
        role: `[DEMO] Rol ${i + 1}`,
        credential_code_hash: hashCode(`DEMO-${letter}${i + 1}`),
        clue_location: `[DEMO] Escondite ${i + 1}`,
        private_mission: `[DEMO] Misión ${i + 1}`,
        display_order: i,
      }))
    );
  }

  await db.from("game_events").insert({
    game_id: game.id,
    event_type: "game_created",
    payload: { demo: true },
  });

  return game;
}
