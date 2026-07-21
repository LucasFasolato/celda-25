"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamStateView } from "@/lib/game/teamState";
import type { StageKey } from "@/lib/types";

interface AttemptResponse {
  outcome: "correct" | "incorrect" | "locked" | "not_active" | "credentials_missing";
  attemptsRemaining?: number;
  lockedUntil?: string;
  escaped?: { position: number };
}

const ERROR_MESSAGES = [
  "Código rechazado por el sistema penitenciario.",
  "La cerradura no cede. Revisen la evidencia.",
  "Señal incorrecta. Los guardias sospechan.",
  "Acceso rechazado. Vuelvan a mirar la celda.",
];

export default function CodeForm({
  token,
  stageKey,
  state,
  onResult,
}: {
  token: string;
  stageKey: StageKey;
  state: TeamStateView;
  onResult: () => void;
}) {
  const stage = state.stages.find((s) => s.key === stageKey);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(stage?.lockedUntil ?? null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    stage?.attemptsRemaining ?? null
  );

  useEffect(() => {
    setLockedUntil(stage?.lockedUntil ?? null);
    setAttemptsRemaining(stage?.attemptsRemaining ?? null);
  }, [stage?.lockedUntil, stage?.attemptsRemaining]);

  const fingerprint = useMemo(() => {
    if (typeof navigator === "undefined") return undefined;
    return `${navigator.platform ?? "?"}|${navigator.userAgent.slice(0, 80)}`;
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !code.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/team/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, stageKey, code, fingerprint }),
      });
      const data = (await res.json()) as AttemptResponse;
      if (data.outcome === "correct") {
        setFeedback({ kind: "success", text: "ACCESO CONCEDIDO" });
        setCode("");
        setTimeout(onResult, 1200);
      } else if (data.outcome === "locked") {
        setLockedUntil(data.lockedUntil ?? null);
        onResult();
      } else if (data.outcome === "incorrect") {
        setAttemptsRemaining(data.attemptsRemaining ?? null);
        setFeedback({
          kind: "error",
          text: ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)],
        });
      } else {
        setFeedback({ kind: "error", text: "El sistema no responde. Actualizando…" });
        onResult();
      }
    } catch {
      setFeedback({ kind: "error", text: "Fallo de conexión. Intenten nuevamente." });
    } finally {
      setSending(false);
    }
  };

  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    return <LockoutCountdown lockedUntil={lockedUntil} onExpired={onResult} />;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {feedback?.kind === "success" ? (
        <p className="access-granted rounded border border-cell-green bg-cell-green/10 p-4 text-center text-lg font-bold tracking-[0.2em] text-cell-green">
          ✓ {feedback.text}
        </p>
      ) : (
        <>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="INGRESAR CÓDIGO"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={100}
            className="w-full rounded border border-cell-border bg-cell-bg p-4 text-center text-lg uppercase tracking-[0.2em] text-cell-text placeholder:text-cell-muted/50 focus:border-cell-amber focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !code.trim()}
            className="w-full rounded border border-cell-amber bg-cell-amber/10 p-4 text-sm font-bold tracking-[0.25em] text-cell-amber transition-colors hover:bg-cell-amber/20 disabled:opacity-40"
          >
            {sending ? "VALIDANDO…" : "VALIDAR ACCESO"}
          </button>
          {feedback?.kind === "error" && (
            <p className="rounded border border-cell-red/50 bg-cell-red/10 p-2 text-center text-xs text-cell-red">
              ✗ {feedback.text}
            </p>
          )}
          {attemptsRemaining !== null && (
            <p className="text-center text-xs text-cell-muted">
              Intentos restantes:{" "}
              <span className={attemptsRemaining <= 2 ? "text-cell-red" : "text-cell-text"}>
                {attemptsRemaining}
              </span>
            </p>
          )}
        </>
      )}
    </form>
  );
}

export function LockoutCountdown({
  lockedUntil,
  onExpired,
}: {
  lockedUntil: string;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(lockedUntil).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(lockedUntil).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil, onExpired]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="emergency rounded border border-cell-red bg-cell-red/10 p-5 text-center">
      <p className="text-sm font-bold tracking-[0.25em] text-cell-red">SISTEMA BLOQUEADO</p>
      <p className="mt-2 text-3xl tabular-nums text-cell-red">
        {mm}:{ss}
      </p>
      <p className="mt-2 text-xs text-cell-muted">
        Demasiados intentos fallidos. Los guardias reforzaron la vigilancia.
      </p>
    </div>
  );
}
