import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  GameRow,
  StageRow,
  TeamRow,
  TeamStageProgressRow,
  StageKey,
} from "@/lib/types";

/** El juego es singleton: una sola partida activa por despliegue. */
export async function getGame(): Promise<GameRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("games")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTeamByToken(token: string): Promise<TeamRow | null> {
  if (!token || token.length < 16) return null;
  const { data, error } = await supabaseAdmin()
    .from("teams")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTeamById(id: string): Promise<TeamRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("teams")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStage(gameId: string, stageKey: StageKey): Promise<StageRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("stages")
    .select("*")
    .eq("game_id", gameId)
    .eq("stage_key", stageKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStages(gameId: string): Promise<StageRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("stages")
    .select("*")
    .eq("game_id", gameId)
    .order("display_order");
  if (error) throw error;
  return data ?? [];
}

/** Obtiene (creando si falta) la fila de progreso de un equipo en una etapa. */
export async function getOrCreateProgress(
  teamId: string,
  stageId: string
): Promise<TeamStageProgressRow> {
  const db = supabaseAdmin();
  const { data: existing, error } = await db
    .from("team_stage_progress")
    .select("*")
    .eq("team_id", teamId)
    .eq("stage_id", stageId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await db
    .from("team_stage_progress")
    .upsert(
      { team_id: teamId, stage_id: stageId, status: "active" },
      { onConflict: "team_id,stage_id" }
    )
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function logEvent(input: {
  gameId: string;
  teamId?: string | null;
  participantId?: string | null;
  adminUserId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin().from("game_events").insert({
    game_id: input.gameId,
    team_id: input.teamId ?? null,
    participant_id: input.participantId ?? null,
    admin_user_id: input.adminUserId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
  });
  if (error) console.error("No se pudo registrar evento", input.eventType, error.message);
}
