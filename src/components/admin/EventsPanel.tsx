"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, type AdminState } from "./types";
import type { GameEventRow } from "@/lib/types";

const EVENT_LABELS: Record<string, string> = {
  game_created: "Partida creada",
  game_started: "Partida iniciada",
  game_reset: "Partida reiniciada",
  team_started: "Equipo iniciado",
  team_paused: "Equipo pausado",
  team_resumed: "Equipo reanudado",
  team_reset: "Equipo reiniciado",
  page_opened: "Página abierta",
  code_correct: "Código correcto",
  code_incorrect: "Código incorrecto",
  lockout_started: "Bloqueo iniciado",
  lockout_ended: "Bloqueo terminado",
  lockout_cleared: "Bloqueo quitado (manual)",
  attempts_reset: "Intentos reseteados",
  hint_requested: "Pista solicitada",
  hint_responded: "Pista respondida",
  hint_dismissed: "Pista descartada",
  video_played: "Video reproducido",
  audio_played: "Audio reproducido",
  final_audio_played: "Audio final reproducido",
  message_created: "Mensaje creado",
  message_sent: "Mensaje enviado",
  message_delivered: "Mensaje entregado",
  message_read: "Mensaje leído",
  message_failed: "Mensaje fallido",
  message_resent: "Mensaje reenviado",
  credential_validated: "Credencial validada",
  credential_invalid: "Credencial inválida",
  stage_completed: "Etapa completada",
  manual_advance: "Avance manual",
  manual_rollback: "Retroceso manual",
  manual_escape: "Fuga manual",
  escape_completed: "Fuga completada",
  winner_assigned: "Ganador asignado",
  winner_invalidated: "Ganador invalidado",
  config_updated: "Configuración actualizada",
  media_uploaded: "Multimedia subida",
  token_regenerated: "Token regenerado",
  access_toggled: "Acceso activado/desactivado",
  play_final_audio: "Audio final disparado",
  stop_audio: "Audio detenido",
};

export default function EventsPanel({ state }: { state: AdminState }) {
  const [events, setEvents] = useState<GameEventRow[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (teamFilter) params.set("teamId", teamFilter);
    if (typeFilter) params.set("type", typeFilter);
    const data = await adminFetch<{ events: GameEventRow[] }>(
      `/api/admin/events?${params.toString()}`
    );
    setEvents(data.events);
  }, [teamFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const teamName = (id: string | null) =>
    id ? (state.teams.find((t) => t.id === id)?.name ?? "?") : "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded border border-cell-border bg-cell-panel p-2 text-xs"
        >
          <option value="">Todos los equipos</option>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-cell-border bg-cell-panel p-2 text-xs"
        >
          <option value="">Todos los eventos</option>
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="rounded border border-cell-border px-3 py-2 text-xs text-cell-muted hover:text-cell-amber"
        >
          ↻ ACTUALIZAR
        </button>
      </div>

      <ul className="space-y-1">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex flex-wrap items-baseline gap-x-3 rounded border border-cell-border/60 bg-cell-panel px-3 py-2 text-xs"
          >
            <span className="tabular-nums text-cell-muted">
              {new Date(event.created_at).toLocaleTimeString("es-AR")}
            </span>
            <span className="text-cell-text">{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
            <span className="text-cell-muted">{teamName(event.team_id)}</span>
            {event.admin_user_id && (
              <span className="text-cell-amber">admin: {event.admin_user_id}</span>
            )}
            {Object.keys(event.payload ?? {}).length > 0 && (
              <span className="break-all text-[10px] text-cell-muted/70">
                {JSON.stringify(event.payload)}
              </span>
            )}
          </li>
        ))}
        {events.length === 0 && (
          <li className="p-4 text-center text-xs text-cell-muted">Sin eventos registrados.</li>
        )}
      </ul>
    </div>
  );
}
