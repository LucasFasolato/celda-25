"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/game/timer";
import { adminFetch, type AdminState, type AdminTeam } from "./types";
import type { HintRequestRow } from "@/lib/types";

const PHASE_LABELS: Record<string, string> = {
  stage_1_access: "Acceso clandestino",
  stage_2_evidence: "Registro de vigilancia",
  stage_3_identity: "Identificación",
  final_escape: "Código de fuga",
  escaped: "FUGADO",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Preparado",
  in_game: "En juego",
  paused: "Pausado",
  escaped: "Fuga completada",
  cancelled: "Cancelado",
};

// Acciones que exigen confirmación previa.
const DESTRUCTIVE = new Set([
  "reset_team",
  "rollback_stage",
  "mark_escaped",
  "declare_winner",
  "invalidate_winner",
  "regenerate_token",
  "complete_stage",
]);

export default function Dashboard({
  state,
  refresh,
}: {
  state: AdminState;
  refresh: () => void;
}) {
  const [confirming, setConfirming] = useState<{ teamId: string; action: string } | null>(null);
  const [qr, setQr] = useState<{ teamName: string; url: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingGame, setConfirmingGame] = useState<string | null>(null);

  const teamAction = async (teamId: string, action: string) => {
    if (DESTRUCTIVE.has(action) && confirming?.action !== action) {
      setConfirming({ teamId, action });
      return;
    }
    setConfirming(null);
    setBusy(true);
    try {
      await adminFetch("/api/admin/team-action", {
        method: "POST",
        body: JSON.stringify({ teamId, action }),
      });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const gameAction = async (action: string) => {
    if (action === "reset_all" && confirmingGame !== action) {
      setConfirmingGame(action);
      return;
    }
    setConfirmingGame(null);
    setBusy(true);
    try {
      await adminFetch("/api/admin/game-action", { method: "POST", body: JSON.stringify({ action }) });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const showQr = async (team: AdminTeam) => {
    const data = await adminFetch<{ url: string; qrDataUrl: string; teamName: string }>(
      `/api/admin/qr?teamId=${team.id}`
    );
    setQr(data);
  };

  const audioControl = async (action: string, target: string) => {
    await adminFetch("/api/admin/audio-control", {
      method: "POST",
      body: JSON.stringify({ action, target }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Acciones globales */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => gameAction("start_all")} disabled={busy} className={btn("amber")}>
          ▶ INICIAR PARTIDA COMPLETA
        </button>
        <button onClick={() => audioControl("play_final_audio", "all")} className={btn("border")}>
          ♪ AUDIO FINAL (TODOS)
        </button>
        <button onClick={() => audioControl("stop_audio", "all")} className={btn("border")}>
          ■ DETENER AUDIO
        </button>
        {confirmingGame === "reset_all" ? (
          <span className="flex gap-2">
            <button onClick={() => gameAction("reset_all")} className={btn("red")}>
              ⚠ CONFIRMAR REINICIO TOTAL
            </button>
            <button onClick={() => setConfirmingGame(null)} className={btn("border")}>
              CANCELAR
            </button>
          </span>
        ) : (
          <button onClick={() => gameAction("reset_all")} className={btn("red")}>
            REINICIAR PARTIDA
          </button>
        )}
      </div>

      {/* Pistas pendientes */}
      <HintsPanel state={state} refresh={refresh} />

      {/* Tarjetas de equipos */}
      <div className="grid gap-4 lg:grid-cols-2">
        {state.teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            confirming={confirming?.teamId === team.id ? confirming.action : null}
            onAction={(action) => teamAction(team.id, action)}
            onCancelConfirm={() => setConfirming(null)}
            onShowQr={() => showQr(team)}
            onAudio={(action) => audioControl(action, team.id)}
            busy={busy}
          />
        ))}
      </div>

      {/* Modal QR */}
      {qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setQr(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-lg border border-cell-border bg-white p-6 text-center text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold tracking-widest">{qr.teamName}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt={`QR ${qr.teamName}`} className="mx-auto w-full max-w-[280px]" />
            <p className="break-all text-[10px] text-gray-600">{qr.url}</p>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(qr.url)}
                className="flex-1 rounded border border-gray-400 p-2 text-xs"
              >
                COPIAR LINK
              </button>
              <a
                href={qr.qrDataUrl}
                download={`qr-${qr.teamName}.png`}
                className="flex-1 rounded border border-gray-400 p-2 text-xs"
              >
                DESCARGAR PNG
              </a>
            </div>
            <button onClick={() => setQr(null)} className="text-xs text-gray-500">
              CERRAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  confirming,
  onAction,
  onCancelConfirm,
  onShowQr,
  onAudio,
  busy,
}: {
  team: AdminTeam;
  confirming: string | null;
  onAction: (action: string) => void;
  onCancelConfirm: () => void;
  onShowQr: () => void;
  onAudio: (action: string) => void;
  busy: boolean;
}) {
  const locked = team.lockedUntil && new Date(team.lockedUntil) > new Date();
  return (
    <section className="rounded-lg border border-cell-border bg-cell-panel p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bold tracking-widest text-cell-amber">
            {team.name}
            {team.isWinner && <span className="ml-2 text-cell-green">★ GANADOR</span>}
          </h3>
          <p className="text-xs text-cell-muted">
            {STATUS_LABELS[team.status] ?? team.status} · {PHASE_LABELS[team.currentPhase]}
            {team.finishingPosition ? ` · Posición ${team.finishingPosition}` : ""}
          </p>
        </div>
        <p className={`tabular-nums ${team.running ? "text-cell-green" : "text-cell-muted"}`}>
          {formatDuration(team.elapsedSeconds)}
        </p>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px] sm:grid-cols-6">
        <Stat label="Intentos" value={`${team.attemptsInWindow}`} warn={team.attemptsInWindow >= 4} />
        <Stat label="Total" value={`${team.totalAttempts}`} />
        <Stat label="Cred." value={`${team.credentialsFound}/${team.credentialsTotal}`} />
        <Stat label="Pistas" value={`${team.hintsRequested}`} />
        <Stat label="Msj OK" value={`${team.messagesSent}`} />
        <Stat label="Msj ✗" value={`${team.messagesFailed}`} warn={team.messagesFailed > 0} />
      </div>

      {locked && (
        <p className="emergency mb-3 rounded border border-cell-red/60 p-2 text-center text-xs text-cell-red">
          BLOQUEADO hasta {new Date(team.lockedUntil!).toLocaleTimeString("es-AR")}
        </p>
      )}
      {!team.accessEnabled && (
        <p className="mb-3 rounded border border-cell-red/40 p-2 text-center text-xs text-cell-red">
          ACCESO DESACTIVADO
        </p>
      )}

      {confirming ? (
        <div className="flex gap-2">
          <button onClick={() => onAction(confirming)} className={btn("red") + " flex-1"}>
            ⚠ CONFIRMAR: {ACTION_LABELS[confirming]}
          </button>
          <button onClick={onCancelConfirm} className={btn("border") + " flex-1"}>
            CANCELAR
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {team.status !== "in_game" && team.status !== "escaped" && (
            <ActionBtn onClick={() => onAction("start")} label="▶ Iniciar" disabled={busy} />
          )}
          {team.status === "in_game" && (
            <ActionBtn onClick={() => onAction("pause")} label="⏸ Pausar" disabled={busy} />
          )}
          {team.status === "paused" && (
            <ActionBtn onClick={() => onAction("resume")} label="▶ Reanudar" disabled={busy} />
          )}
          <ActionBtn onClick={() => onAction("clear_lockout")} label="Quitar bloqueo" disabled={busy} />
          <ActionBtn onClick={() => onAction("reset_attempts")} label="Resetear intentos" disabled={busy} />
          <ActionBtn onClick={() => onAction("complete_stage")} label="Completar etapa" disabled={busy} />
          <ActionBtn onClick={() => onAction("rollback_stage")} label="Retroceder etapa" disabled={busy} />
          {team.currentPhase !== "escaped" && (
            <ActionBtn onClick={() => onAction("mark_escaped")} label="Marcar fuga" disabled={busy} />
          )}
          {team.isWinner ? (
            <ActionBtn onClick={() => onAction("invalidate_winner")} label="Invalidar ganador" disabled={busy} />
          ) : (
            <ActionBtn onClick={() => onAction("declare_winner")} label="Declarar ganador" disabled={busy} />
          )}
          <ActionBtn onClick={() => onAction("reset_team")} label="Reiniciar equipo" disabled={busy} danger />
          <ActionBtn onClick={onShowQr} label="Ver QR" disabled={false} />
          <ActionBtn
            onClick={() => navigator.clipboard.writeText(team.accessUrl)}
            label="Copiar link"
            disabled={false}
          />
          <a href={team.accessUrl} target="_blank" rel="noreferrer" className={btnSmall(false)}>
            Abrir vista
          </a>
          <ActionBtn
            onClick={() => onAction("toggle_access")}
            label={team.accessEnabled ? "Desactivar acceso" : "Activar acceso"}
            disabled={busy}
          />
          <ActionBtn onClick={() => onAction("regenerate_token")} label="Regenerar token" disabled={busy} danger />
          <ActionBtn onClick={() => onAudio("play_final_audio")} label="♪ Audio final" disabled={false} />
          <ActionBtn onClick={() => onAudio("stop_audio")} label="■ Stop audio" disabled={false} />
        </div>
      )}
    </section>
  );
}

const ACTION_LABELS: Record<string, string> = {
  reset_team: "Reiniciar equipo",
  rollback_stage: "Retroceder etapa",
  mark_escaped: "Marcar fuga",
  declare_winner: "Declarar ganador",
  invalidate_winner: "Invalidar ganador",
  regenerate_token: "Regenerar token",
  complete_stage: "Completar etapa",
};

function HintsPanel({ state, refresh }: { state: AdminState; refresh: () => void }) {
  const [responding, setResponding] = useState<HintRequestRow | null>(null);
  const [text, setText] = useState("");
  const pending = state.hints.filter((h) => h.status === "pending");
  if (pending.length === 0 && !responding) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? "?";

  const respond = async (action: "respond_screen" | "dismiss") => {
    if (!responding) return;
    await adminFetch("/api/admin/hints", {
      method: "POST",
      body: JSON.stringify({
        hintId: responding.id,
        action,
        responseText: action === "dismiss" ? undefined : text,
      }),
    });
    setResponding(null);
    setText("");
    refresh();
  };

  return (
    <section className="emergency rounded-lg border border-cell-red/60 bg-cell-panel p-4">
      <h3 className="mb-2 text-xs font-bold tracking-[0.25em] text-cell-red">
        ⚠ SOLICITUDES DE PISTA PENDIENTES ({pending.length})
      </h3>
      <ul className="space-y-2">
        {pending.map((hint) => (
          <li key={hint.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {teamName(hint.team_id)} · {PHASE_LABELS[hint.stage_key] ?? hint.stage_key} ·{" "}
              {new Date(hint.requested_at).toLocaleTimeString("es-AR")}
            </span>
            <button onClick={() => setResponding(hint)} className={btn("amber")}>
              RESPONDER
            </button>
          </li>
        ))}
      </ul>
      {responding && (
        <div className="mt-3 space-y-2 border-t border-cell-border pt-3">
          <p className="text-xs text-cell-muted">
            Respuesta para {teamName(responding.team_id)} (se muestra en la pantalla del equipo):
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full rounded border border-cell-border bg-cell-bg p-2 text-sm focus:border-cell-amber focus:outline-none"
            placeholder="Escribí la pista…"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => respond("respond_screen")} disabled={!text.trim()} className={btn("amber")}>
              ENVIAR A PANTALLA
            </button>
            <button onClick={() => respond("dismiss")} className={btn("border")}>
              MARCAR RESUELTA SIN ENVIAR
            </button>
            <button onClick={() => setResponding(null)} className={btn("border")}>
              CANCELAR
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded border px-1 py-1.5 ${warn ? "border-cell-red/60 text-cell-red" : "border-cell-border text-cell-text"}`}>
      <p className="text-[9px] text-cell-muted">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function ActionBtn({
  onClick,
  label,
  disabled,
  danger,
}: {
  onClick: () => void;
  label: string;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={btnSmall(danger)}>
      {label}
    </button>
  );
}

function btnSmall(danger?: boolean) {
  return `rounded border px-2 py-1.5 text-[11px] disabled:opacity-40 ${
    danger
      ? "border-cell-red/50 text-cell-red hover:bg-cell-red/10"
      : "border-cell-border text-cell-muted hover:border-cell-amber hover:text-cell-amber"
  }`;
}

function btn(kind: "amber" | "red" | "border") {
  const base = "rounded border px-3 py-2 text-xs tracking-widest disabled:opacity-40 ";
  if (kind === "amber") return base + "border-cell-amber bg-cell-amber/10 text-cell-amber";
  if (kind === "red") return base + "border-cell-red bg-cell-red/10 text-cell-red";
  return base + "border-cell-border text-cell-muted hover:text-cell-text";
}
