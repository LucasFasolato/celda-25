import type { GameRow, HintRequestRow, MediaAssetRow } from "@/lib/types";

export interface AdminPlayer {
  id: string;
  name: string;
  phone: string;
  role: string;
  credentialConfigured: boolean;
  credentialFound: boolean;
  clueLocation: string;
  privateMission: string;
  privateMessage: string;
  messageEnabled: boolean;
  displayOrder: number;
}

export interface AdminTeam {
  id: string;
  name: string;
  status: string;
  currentPhase: string;
  accessEnabled: boolean;
  accessUrl: string;
  elapsedSeconds: number;
  running: boolean;
  attemptsInWindow: number;
  totalAttempts: number;
  lockedUntil: string | null;
  hintsRequested: number;
  credentialsFound: number;
  credentialsTotal: number;
  messagesSent: number;
  messagesFailed: number;
  escapedAt: string | null;
  finishingPosition: number | null;
  isWinner: boolean;
  players: AdminPlayer[];
}

export interface AdminMessage {
  id: string;
  participant_id: string;
  team_id: string;
  provider: string;
  message_body: string;
  message_version: number;
  is_resend: boolean;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  participantName: string;
  participantPhone: string;
}

export interface AdminStage {
  id: string;
  stageKey: string;
  name: string;
  codeConfigured: boolean;
}

export interface AdminState {
  game: GameRow;
  stages: AdminStage[];
  teams: AdminTeam[];
  hints: HintRequestRow[];
  messages: AdminMessage[];
  media: MediaAssetRow[];
  pendingHints: number;
  realtimeTopic: string;
  whatsappConfigured: boolean;
  serverTime: string;
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw Object.assign(new Error("unauthorized"), { status: 401 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
