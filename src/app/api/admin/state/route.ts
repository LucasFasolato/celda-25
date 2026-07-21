import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureGame } from "@/lib/game/bootstrap";
import { elapsedSeconds } from "@/lib/game/timer";
import { adminTopic } from "@/lib/realtime";
import { env } from "@/lib/env";
import type {
  HintRequestRow,
  OutboundMessageRow,
  ParticipantRow,
  StageRow,
  TeamRow,
  TeamStageProgressRow,
} from "@/lib/types";

/** Estado completo del dashboard admin. Crea la partida demo si no existe. */
export async function GET() {
  return withAdmin(async () => {
    const game = await ensureGame();
    const db = supabaseAdmin();
    const now = new Date();

    const [teamsRes, stagesRes, progressRes, participantsRes, foundRes, hintsRes, messagesRes, mediaRes] =
      await Promise.all([
        db.from("teams").select("*").eq("game_id", game.id).order("created_at"),
        db.from("stages").select("*").eq("game_id", game.id).order("display_order"),
        db.from("team_stage_progress").select("*"),
        db.from("participants").select("*").order("display_order"),
        db.from("participant_credentials_found").select("*"),
        db.from("hint_requests").select("*").order("requested_at", { ascending: false }),
        db.from("outbound_messages").select("*").order("created_at", { ascending: false }),
        db.from("media_assets").select("*").eq("game_id", game.id),
      ]);

    const teams = (teamsRes.data ?? []) as TeamRow[];
    const participants = (participantsRes.data ?? []) as ParticipantRow[];
    const progress = (progressRes.data ?? []) as TeamStageProgressRow[];
    const messages = (messagesRes.data ?? []) as OutboundMessageRow[];
    const hints = (hintsRes.data ?? []) as HintRequestRow[];
    const stages = (stagesRes.data ?? []) as StageRow[];
    const found = foundRes.data ?? [];

    return {
      game: {
        ...game,
        // Nunca exponer hashes al frontend admin: solo si están configurados.
      },
      stages: stages.map((s) => ({
        id: s.id,
        stageKey: s.stage_key,
        name: s.name,
        codeConfigured: Boolean(s.correct_code_hash),
        maxAttempts: s.max_attempts,
        lockoutMinutes: s.lockout_minutes,
      })),
      teams: teams.map((team) => {
        const teamProgress = progress.filter((p) => p.team_id === team.id);
        const teamParticipants = participants.filter((p) => p.team_id === team.id);
        const teamMessages = messages.filter((m) => m.team_id === team.id);
        const currentStage = stages.find((s) => s.stage_key === team.current_phase);
        const currentProgress = currentStage
          ? teamProgress.find((p) => p.stage_id === currentStage.id)
          : null;
        const lockedUntil =
          currentProgress?.locked_until && new Date(currentProgress.locked_until) > now
            ? currentProgress.locked_until
            : null;
        return {
          id: team.id,
          name: team.name,
          status: team.status,
          currentPhase: team.current_phase,
          accessEnabled: team.access_enabled,
          accessUrl: `${env.appUrl}/celda/${team.access_token}`,
          elapsedSeconds: elapsedSeconds(team, now),
          running: team.status === "in_game" && !team.paused_at,
          attemptsInWindow: currentProgress?.attempts_in_window ?? 0,
          totalAttempts: teamProgress.reduce((sum, p) => sum + p.total_attempts, 0),
          lockedUntil,
          hintsRequested: hints.filter((h) => h.team_id === team.id).length,
          credentialsFound: found.filter((f) => f.team_id === team.id).length,
          credentialsTotal: teamParticipants.length,
          messagesSent: teamMessages.filter((m) =>
            ["sent", "delivered", "read", "simulated"].includes(m.status)
          ).length,
          messagesFailed: teamMessages.filter((m) => m.status === "failed").length,
          escapedAt: team.escaped_at,
          finishingPosition: team.finishing_position,
          isWinner: game.winner_team_id === team.id,
          players: teamParticipants.map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone_e164,
            role: p.role,
            credentialConfigured: Boolean(p.credential_code_hash),
            credentialFound: found.some((f) => f.participant_id === p.id),
            clueLocation: p.clue_location,
            privateMission: p.private_mission,
            privateMessage: p.private_message,
            messageEnabled: p.message_enabled,
            displayOrder: p.display_order,
          })),
        };
      }),
      hints,
      messages: messages.map((m) => {
        const participant = participants.find((p) => p.id === m.participant_id);
        return {
          ...m,
          participantName: participant?.name ?? "?",
          participantPhone: participant?.phone_e164 ?? "",
        };
      }),
      media: mediaRes.data ?? [],
      pendingHints: hints.filter((h) => h.status === "pending").length,
      realtimeTopic: adminTopic(),
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseAnonKey,
      whatsappConfigured: env.whatsapp.isConfigured,
      serverTime: now.toISOString(),
    };
  });
}
