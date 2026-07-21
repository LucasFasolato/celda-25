-- CELDA 25 – Cárcel del Quincho
-- Migración inicial: esquema completo del juego.
-- Toda la lógica pasa por el backend con service role; RLS = deny-all para anon.

create extension if not exists "pgcrypto";

-- ── games ─────────────────────────────────────────────────────────────────────
create table games (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'CELDA 25 – CÁRCEL DEL QUINCHO',
  description text not null default '',
  status text not null default 'setup'
    check (status in ('setup','ready','in_progress','paused','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  winner_team_id uuid,
  max_attempts int not null default 5,
  lockout_minutes int not null default 5,
  messaging_mode text not null default 'mock' check (messaging_mode in ('mock','whatsapp')),
  hints_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── teams ─────────────────────────────────────────────────────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  -- Token en claro: el admin necesita re-mostrar/reimprimir el QR en cualquier momento.
  access_token text not null unique,
  access_enabled boolean not null default true,
  status text not null default 'ready'
    check (status in ('ready','in_game','paused','escaped','cancelled')),
  current_phase text not null default 'stage_1_access'
    check (current_phase in ('stage_1_access','stage_2_evidence','stage_3_identity','final_escape','escaped')),
  started_at timestamptz,
  paused_at timestamptz,
  paused_duration_seconds int not null default 0,
  escaped_at timestamptz,
  finishing_position int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table games
  add constraint games_winner_fk foreign key (winner_team_id) references teams(id) on delete set null;

-- ── participants ──────────────────────────────────────────────────────────────
create table participants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  phone_e164 text not null default '',
  role text not null default '',
  credential_code_hash text not null default '',
  private_message text not null default '',
  private_mission text not null default '',
  clue_location text not null default '',
  display_order int not null default 0,
  message_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── stages ────────────────────────────────────────────────────────────────────
create table stages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  stage_key text not null
    check (stage_key in ('stage_1_access','stage_2_evidence','stage_3_identity','final_escape')),
  name text not null,
  correct_code_hash text not null default '',
  max_attempts int,
  lockout_minutes int,
  media_config jsonb not null default '{}'::jsonb,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, stage_key)
);

-- ── team_stage_progress ───────────────────────────────────────────────────────
create table team_stage_progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked','active','completed')),
  attempts_in_window int not null default 0,
  total_attempts int not null default 0,
  locked_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, stage_id)
);

-- ── code_attempts ─────────────────────────────────────────────────────────────
create table code_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  submitted_value_normalized text not null,
  was_correct boolean not null,
  attempted_at timestamptz not null default now(),
  client_fingerprint text
);

-- ── participant_credentials_found ─────────────────────────────────────────────
create table participant_credentials_found (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  found_at timestamptz not null default now(),
  entered_from_session text,
  unique (team_id, participant_id)
);

-- ── outbound_messages ─────────────────────────────────────────────────────────
create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  stage_key text not null default 'stage_3_identity',
  provider text not null default 'mock' check (provider in ('mock','whatsapp')),
  external_message_id text,
  message_body text not null,
  message_version int not null default 1,
  is_resend boolean not null default false,
  batch_key text,
  status text not null default 'pending'
    check (status in ('pending','sent','delivered','read','failed','simulated')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotencia de tandas: una sola tanda automática por equipo+etapa+participante+versión.
create unique index outbound_messages_batch_unique
  on outbound_messages (batch_key, participant_id) where batch_key is not null;

-- ── hint_requests ─────────────────────────────────────────────────────────────
create table hint_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage_key text not null,
  status text not null default 'pending' check (status in ('pending','responded','dismissed')),
  requested_at timestamptz not null default now(),
  response_text text,
  responded_at timestamptz,
  responded_by text
);

-- ── game_events ───────────────────────────────────────────────────────────────
create table game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  participant_id uuid references participants(id) on delete set null,
  admin_user_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_game_created_idx on game_events (game_id, created_at desc);
create index game_events_team_idx on game_events (team_id);

-- ── media_assets ──────────────────────────────────────────────────────────────
create table media_assets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  asset_type text not null check (asset_type in ('stage2_video','stage2_audio','final_audio')),
  storage_path text not null,
  mime_type text not null,
  duration_seconds int,
  created_at timestamptz not null default now(),
  unique (game_id, asset_type)
);

-- ── RLS: deny-all. El cliente nunca lee tablas; todo pasa por la API. ─────────
alter table games enable row level security;
alter table teams enable row level security;
alter table participants enable row level security;
alter table stages enable row level security;
alter table team_stage_progress enable row level security;
alter table code_attempts enable row level security;
alter table participant_credentials_found enable row level security;
alter table outbound_messages enable row level security;
alter table hint_requests enable row level security;
alter table game_events enable row level security;
alter table media_assets enable row level security;
-- Sin políticas: anon/authenticated no acceden a nada. service_role las omite.
