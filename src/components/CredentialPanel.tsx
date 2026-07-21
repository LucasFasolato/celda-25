"use client";

import { useState } from "react";
import type { TeamStateView } from "@/lib/game/teamState";
import CodeForm from "./CodeForm";

interface CredentialResponse {
  outcome: "found" | "invalid" | "already_used" | "not_active";
  playerName?: string;
  found?: number;
  total?: number;
}

export default function CredentialPanel({
  token,
  state,
  onResult,
}: {
  token: string;
  state: TeamStateView;
  onResult: () => void;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const complete = state.credentials.found >= state.credentials.total;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !code.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/team/credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      const data = (await res.json()) as CredentialResponse;
      if (data.outcome === "found") {
        setFeedback({ kind: "ok", text: `Prisionero localizado: ${data.playerName}` });
        setCode("");
        onResult();
      } else if (data.outcome === "already_used") {
        setFeedback({
          kind: "error",
          text: `Esa credencial ya fue registrada (${data.playerName}).`,
        });
      } else {
        setFeedback({ kind: "error", text: "Credencial no reconocida por el sistema." });
      }
    } catch {
      setFeedback({ kind: "error", text: "Fallo de conexión. Intenten nuevamente." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {state.messages.failedOrPending > 0 && (
        <p className="rounded border border-cell-amber/40 bg-cell-amber/5 p-2 text-xs text-cell-amber">
          ⚠ Hay transmisiones personales pendientes de entrega. Si alguien no recibió su mensaje,
          avisen al exterior.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs tracking-[0.25em] text-cell-muted">
          PRISIONEROS LOCALIZADOS — {state.credentials.found}/{state.credentials.total}
        </p>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {state.credentials.players.map((player, i) => (
            <li
              key={i}
              className={`flex items-center justify-between rounded border px-3 py-2 text-xs ${
                player.found
                  ? "border-cell-green/50 bg-cell-green/5 text-cell-green"
                  : "border-cell-border text-cell-muted"
              }`}
            >
              <span>{player.name}</span>
              <span>{player.found ? "LOCALIZADO" : "PENDIENTE"}</span>
            </li>
          ))}
        </ul>
      </div>

      {!complete ? (
        <form onSubmit={submit} className="space-y-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO DE CREDENCIAL"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={60}
            className="w-full rounded border border-cell-border bg-cell-bg p-3 text-center uppercase tracking-[0.15em] text-cell-text placeholder:text-cell-muted/50 focus:border-cell-amber focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !code.trim()}
            className="w-full rounded border border-cell-amber bg-cell-amber/10 p-3 text-xs font-bold tracking-[0.25em] text-cell-amber hover:bg-cell-amber/20 disabled:opacity-40"
          >
            {sending ? "VERIFICANDO…" : "REGISTRAR CREDENCIAL"}
          </button>
          {feedback && (
            <p
              className={`rounded border p-2 text-center text-xs ${
                feedback.kind === "ok"
                  ? "border-cell-green/50 bg-cell-green/10 text-cell-green"
                  : "border-cell-red/50 bg-cell-red/10 text-cell-red"
              }`}
            >
              {feedback.text}
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          <p className="access-granted rounded border border-cell-green/50 bg-cell-green/10 p-3 text-center text-sm text-cell-green">
            ✓ Los seis prisioneros fueron identificados. Ingresen el código de la operación.
          </p>
          <CodeForm token={token} stageKey="stage_3_identity" state={state} onResult={onResult} />
        </div>
      )}
    </div>
  );
}
