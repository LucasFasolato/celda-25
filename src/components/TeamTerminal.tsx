"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeTopic } from "@/hooks/useRealtimeTopic";
import { formatDuration } from "@/lib/game/timer";
import type { TeamStateView } from "@/lib/game/teamState";
import CodeForm from "./CodeForm";
import MediaPlayers from "./MediaPlayers";
import CredentialPanel from "./CredentialPanel";
import EscapeScreen from "./EscapeScreen";
import HintButton from "./HintButton";

async function api<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error("api_error"), { status: res.status, data });
  }
  return res.json();
}

export default function TeamTerminal({ token }: { token: string }) {
  const [state, setState] = useState<TeamStateView | null>(null);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [audioCommand, setAudioCommand] = useState<"play" | "stop" | null>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<TeamStateView>("/api/team/state", {
        token,
        firstLoad: firstLoad.current,
      });
      firstLoad.current = false;
      setState(data);
      setLoadError(false);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 404) setDenied(true);
      else setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime + polling de respaldo (suave).
  useRealtimeTopic(`team:${token}`, {
    refresh: () => refresh(),
    play_final_audio: () => setAudioCommand("play"),
    stop_audio: () => setAudioCommand("stop"),
  });
  useEffect(() => {
    const interval = setInterval(refresh, 20_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (denied) return <AccessDenied />;
  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="flicker text-sm tracking-widest text-cell-muted">
          {loadError ? "SIN CONEXIÓN — REINTENTANDO…" : "ESTABLECIENDO CONEXIÓN…"}
        </p>
      </main>
    );
  }

  if (state.team.currentPhase === "escaped" && state.escape) {
    return (
      <EscapeScreen
        state={state}
        token={token}
        audioCommand={audioCommand}
        onAudioCommandHandled={() => setAudioCommand(null)}
      />
    );
  }

  const phase = state.team.currentPhase;
  const notStarted = state.team.status === "ready";
  const paused = state.team.status === "paused";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4 pb-10">
      <Header state={state} />
      <ProgressIndicators state={state} />

      {loadError && (
        <p className="rounded border border-cell-red/50 bg-cell-red/10 p-2 text-center text-xs text-cell-red">
          Conexión inestable. Reintentando…
        </p>
      )}

      {notStarted ? (
        <Panel title="EN ESPERA">
          <p className="text-sm text-cell-muted">
            La operación todavía no comenzó. Esperen la señal del exterior.
          </p>
        </Panel>
      ) : paused ? (
        <Panel title="OPERACIÓN SUSPENDIDA">
          <p className="emergency inline-block rounded border border-cell-red px-3 py-2 text-sm text-cell-red">
            Guardias en la zona. Cronómetro detenido. No se muevan.
          </p>
        </Panel>
      ) : (
        <>
          {phase === "stage_1_access" && (
            <Panel title="ACCESO CLANDESTINO">
              <p className="mb-4 text-sm leading-relaxed text-cell-muted">
                Se encontró una conexión no vigilada. Ingresen la contraseña recuperada dentro de
                la celda.
              </p>
              <CodeForm token={token} stageKey="stage_1_access" state={state} onResult={refresh} />
            </Panel>
          )}

          {phase === "stage_2_evidence" && (
            <Panel title="REGISTRO DE VIGILANCIA">
              <p className="mb-4 text-sm leading-relaxed text-cell-muted">
                Se recuperaron archivos de seguridad incompletos. Analicen todo el material y
                compárenlo con la evidencia encontrada en la celda.
              </p>
              <MediaPlayers token={token} state={state} />
              <div className="my-4 rounded border border-dashed border-cell-border p-3 text-xs text-cell-muted">
                ⚠ Falta un registro físico. Debe estar dentro de la celda.
              </div>
              <CodeForm token={token} stageKey="stage_2_evidence" state={state} onResult={refresh} />
            </Panel>
          )}

          {phase === "stage_3_identity" && (
            <Panel title="IDENTIFICACIÓN DE PRISIONEROS">
              <CredentialPanel token={token} state={state} onResult={refresh} />
            </Panel>
          )}

          {phase === "final_escape" && (
            <Panel title="CÓDIGO DE FUGA" accent>
              <p className="mb-4 text-sm leading-relaxed text-cell-muted">
                Detectaron los puntos débiles de la prisión. Reconstruyan el código definitivo y
                liberen la puerta.
              </p>
              <CodeForm token={token} stageKey="final_escape" state={state} onResult={refresh} />
            </Panel>
          )}

          <HintButton token={token} state={state} onResult={refresh} />
        </>
      )}

      <HintResponses state={state} />
    </main>
  );
}

function Header({ state }: { state: TeamStateView }) {
  const [elapsed, setElapsed] = useState(state.team.elapsedSeconds);
  const baseRef = useRef({ value: state.team.elapsedSeconds, at: Date.now() });

  useEffect(() => {
    baseRef.current = { value: state.team.elapsedSeconds, at: Date.now() };
    setElapsed(state.team.elapsedSeconds);
  }, [state.team.elapsedSeconds]);

  useEffect(() => {
    if (!state.team.running) return;
    const interval = setInterval(() => {
      setElapsed(baseRef.current.value + Math.floor((Date.now() - baseRef.current.at) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.team.running]);

  return (
    <header className="flex items-center justify-between border-b border-cell-border pb-3">
      <div>
        <h1 className="text-xl font-bold tracking-[0.2em] text-cell-amber">CELDA 25</h1>
        <p className="text-[10px] tracking-[0.3em] text-cell-muted">CÁRCEL DEL QUINCHO</p>
        <p className="mt-1 text-xs text-cell-text">{state.team.name}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] tracking-widest text-cell-muted">TIEMPO</p>
        <p
          className={`text-lg tabular-nums ${state.team.running ? "text-cell-green" : "text-cell-muted"}`}
        >
          {formatDuration(elapsed)}
        </p>
      </div>
    </header>
  );
}

function ProgressIndicators({ state }: { state: TeamStateView }) {
  const labels: Record<string, string> = {
    stage_1_access: "Acceso inicial",
    stage_2_evidence: "Evidencia recuperada",
    stage_3_identity: "Identidades localizadas",
    final_escape: "Código de fuga",
  };
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
      {state.stages.map((stage) => {
        const done = stage.status === "completed";
        const active = stage.status === "active";
        const label =
          stage.key === "stage_3_identity"
            ? `${labels[stage.key]} ${state.credentials.found}/${state.credentials.total}`
            : labels[stage.key];
        return (
          <div
            key={stage.key}
            className={`rounded border px-2 py-1.5 text-center ${
              done
                ? "border-cell-green/60 text-cell-green"
                : active
                  ? "border-cell-amber/60 text-cell-amber"
                  : "border-cell-border text-cell-muted"
            }`}
          >
            {done ? "✓ " : active ? "▸ " : "▪ "}
            {label}
          </div>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-cell-panel p-4 ${
        accent ? "emergency border-cell-red/60" : "border-cell-border"
      }`}
    >
      <h2
        className={`mb-3 text-sm font-bold tracking-[0.25em] ${accent ? "text-cell-red" : "text-cell-amber"}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function HintResponses({ state }: { state: TeamStateView }) {
  if (state.hints.responses.length === 0) return null;
  return (
    <section className="rounded-lg border border-cell-border bg-cell-panel p-4">
      <h3 className="mb-2 text-xs font-bold tracking-[0.25em] text-cell-muted">
        TRANSMISIONES RECIBIDAS
      </h3>
      <ul className="space-y-2">
        {state.hints.responses.map((r, i) => (
          <li key={i} className="rounded border border-cell-amber/30 bg-cell-amber/5 p-2 text-xs">
            <span className="text-cell-amber">▸</span> {r.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccessDenied() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="emergency rounded border-2 border-cell-red px-6 py-4">
        <h1 className="text-2xl font-bold tracking-[0.25em] text-cell-red">ACCESO DENEGADO</h1>
      </div>
      <p className="max-w-sm text-sm text-cell-muted">
        Este canal no está autorizado. La credencial es inválida o fue revocada por el
        penitenciario.
      </p>
    </main>
  );
}
