import { supabaseAdmin } from "@/lib/supabase/admin";
import { elapsedSeconds } from "./timer";
import { isStageCompleted } from "./stateMachine";
import { env } from "@/lib/env";
import {
  STAGE_ORDER,
  STAGE_NAMES,
  type GameRow,
  type MediaAssetRow,
  type StageKey,
  type TeamRow,
  type TeamStageProgressRow,
} from "@/lib/types";

/** Estado completo que ve el equipo. Nunca incluye códigos ni teléfonos. */
export interface TeamStateView {
  team: {
    name: string;
    status: string;
    currentPhase: string;
    elapsedSeconds: number;
    running: boolean;
    finishingPosition: number | null;
  };
  game: { name: string; hintsEnabled: boolean };
  stages: {
    key: StageKey;
    name: string;
    status: "locked" | "active" | "completed";
    attemptsRemaining: number | null;
    lockedUntil: string | null;
  }[];
  credentials: {
    found: number;
    total: number;
    players: { name: string; found: boolean }[];
  };
  media: { videoUrl: string | null; audioUrl: string | null; finalAudioUrl: string | null };
  hints: {
    pendingRequest: boolean;
    responses: { stageKey: string; text: string; respondedAt: string }[];
  };
  messages: { total: number; failedOrPending: number };
  escape: {
    escapedAt: string | null;
    position: number | null;
    totalAttempts: number;
    hintsRequested: number;
  } | null;
  serverTime: string;
}

export function publicMediaUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/media/${path}`;
}

export async function buildTeamState(game: GameRow, team: TeamRow): Promise<TeamStateView> {
  const db = supabaseAdmin();
  const now = new Date();

  const [stagesRes, progressRes, participantsRes, foundRes, hintsRes, mediaRes, messagesRes] =
    await Promise.all([
      db.from("stages").select("*").eq("game_id", game.id).order("display_order"),
      db.from("team_stage_progress").select("*").eq("team_id", team.id),
      db
        .from("participants")
        .select("id,name,display_order")
        .eq("team_id", team.id)
        .order("display_order"),
      db.from("participant_credentials_found").select("participant_id").eq("team_id", team.id),
      db
        .from("hint_requests")
        .select("*")
        .eq("team_id", team.id)
        .order("requested_at", { ascending: false }),
      db.from("media_assets").select("*").eq("game_id", game.id),
      db.from("outbound_messages").select("status").eq("team_id", team.id),
    ]);

  const progressByStage = new Map<string, TeamStageProgressRow>();
  for (const p of (progressRes.data ?? []) as TeamStageProgressRow[]) {
    progressByStage.set(p.stage_id, p);
  }

  const stages = (stagesRes.data ?? [])
    .sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage_key as StageKey) - STAGE_ORDER.indexOf(b.stage_key as StageKey)
    )
    .map((stage) => {
      const key = stage.stage_key as StageKey;
      const progress = progressByStage.get(stage.id);
      const completed = isStageCompleted(key, team.current_phase) || progress?.status === "completed";
      const active = team.current_phase === key;
      const maxAttempts = stage.max_attempts ?? game.max_attempts;
      const lockedUntil =
        progress?.locked_until && new Date(progress.locked_until) > now
          ? progress.locked_until
          : null;
      return {
        key,
        name: stage.name || STAGE_NAMES[key],
        status: completed ? ("completed" as const) : active ? ("active" as const) : ("locked" as const),
        attemptsRemaining: active
          ? Math.max(0, maxAttempts - (lockedUntil ? maxAttempts : (progress?.attempts_in_window ?? 0)))
          : null,
        lockedUntil,
      };
    });

  const foundIds = new Set((foundRes.data ?? []).map((f) => f.participant_id as string));
  const players = (participantsRes.data ?? []).map((p) => ({
    name: p.name as string,
    found: foundIds.has(p.id as string),
  }));

  const media = (mediaRes.data ?? []) as MediaAssetRow[];
  const stage2Visible =
    isStageCompleted("stage_2_evidence", team.current_phase) ||
    team.current_phase === "stage_2_evidence";
  const video = media.find((m) => m.asset_type === "stage2_video");
  const audio = media.find((m) => m.asset_type === "stage2_audio");
  const finalAudio = media.find((m) => m.asset_type === "final_audio");
  const escaped = team.current_phase === "escaped";

  const hintRows = hintsRes.data ?? [];
  const messageRows = messagesRes.data ?? [];

  const totalAttempts = (progressRes.data ?? []).reduce(
    (sum, p) => sum + (p.total_attempts as number),
    0
  );

  return {
    team: {
      name: team.name,
      status: team.status,
      currentPhase: team.current_phase,
      elapsedSeconds: elapsedSeconds(team, now),
      running: team.status === "in_game" && !team.paused_at,
      finishingPosition: team.finishing_position,
    },
    game: { name: game.name, hintsEnabled: game.hints_enabled },
    stages,
    credentials: { found: foundIds.size, total: players.length || 6, players },
    media: {
      videoUrl: stage2Visible && video ? publicMediaUrl(video.storage_path) : null,
      audioUrl: stage2Visible && audio ? publicMediaUrl(audio.storage_path) : null,
      finalAudioUrl: escaped && finalAudio ? publicMediaUrl(finalAudio.storage_path) : null,
    },
    hints: {
      pendingRequest: hintRows.some((h) => h.status === "pending"),
      responses: hintRows
        .filter((h) => h.status === "responded" && h.response_text)
        .map((h) => ({
          stageKey: h.stage_key as string,
          text: h.response_text as string,
          respondedAt: h.responded_at as string,
        })),
    },
    messages: {
      total: messageRows.length,
      failedOrPending: messageRows.filter((m) => m.status === "failed" || m.status === "pending")
        .length,
    },
    escape: escaped
      ? {
          escapedAt: team.escaped_at,
          position: team.finishing_position,
          totalAttempts,
          hintsRequested: hintRows.length,
        }
      : null,
    serverTime: now.toISOString(),
  };
}
