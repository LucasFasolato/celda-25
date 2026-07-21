// Tipos compartidos del dominio. Reflejan el esquema de supabase/migrations.

export type GameStatus =
  | "setup"
  | "ready"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type TeamStatus = "ready" | "in_game" | "paused" | "escaped" | "cancelled";

export type StageKey =
  | "stage_1_access"
  | "stage_2_evidence"
  | "stage_3_identity"
  | "final_escape";

export type TeamPhase = StageKey | "escaped";

export type StageProgressStatus = "locked" | "active" | "completed";

export type MessagingMode = "mock" | "whatsapp";

export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "simulated";

export const STAGE_ORDER: StageKey[] = [
  "stage_1_access",
  "stage_2_evidence",
  "stage_3_identity",
  "final_escape",
];

export const STAGE_NAMES: Record<StageKey, string> = {
  stage_1_access: "Acceso clandestino",
  stage_2_evidence: "Registro de vigilancia",
  stage_3_identity: "Identificación de prisioneros",
  final_escape: "Código de fuga",
};

export interface GameRow {
  id: string;
  name: string;
  description: string;
  status: GameStatus;
  started_at: string | null;
  completed_at: string | null;
  winner_team_id: string | null;
  max_attempts: number;
  lockout_minutes: number;
  messaging_mode: MessagingMode;
  hints_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: string;
  game_id: string;
  name: string;
  access_token: string;
  access_enabled: boolean;
  status: TeamStatus;
  current_phase: TeamPhase;
  started_at: string | null;
  paused_at: string | null;
  paused_duration_seconds: number;
  escaped_at: string | null;
  finishing_position: number | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantRow {
  id: string;
  team_id: string;
  name: string;
  phone_e164: string;
  role: string;
  credential_code_hash: string;
  private_message: string;
  private_mission: string;
  clue_location: string;
  display_order: number;
  message_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface StageRow {
  id: string;
  game_id: string;
  stage_key: StageKey;
  name: string;
  correct_code_hash: string;
  max_attempts: number | null;
  lockout_minutes: number | null;
  media_config: Record<string, unknown>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeamStageProgressRow {
  id: string;
  team_id: string;
  stage_id: string;
  status: StageProgressStatus;
  attempts_in_window: number;
  total_attempts: number;
  locked_until: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutboundMessageRow {
  id: string;
  participant_id: string;
  team_id: string;
  stage_key: string;
  provider: MessagingMode;
  external_message_id: string | null;
  message_body: string;
  message_version: number;
  is_resend: boolean;
  batch_key: string | null;
  status: MessageStatus;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HintRequestRow {
  id: string;
  team_id: string;
  stage_key: string;
  status: "pending" | "responded" | "dismissed";
  requested_at: string;
  response_text: string | null;
  responded_at: string | null;
  responded_by: string | null;
}

export interface GameEventRow {
  id: string;
  game_id: string;
  team_id: string | null;
  participant_id: string | null;
  admin_user_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface MediaAssetRow {
  id: string;
  game_id: string;
  asset_type: "stage2_video" | "stage2_audio" | "final_audio";
  storage_path: string;
  mime_type: string;
  duration_seconds: number | null;
  created_at: string;
}
