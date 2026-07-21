"use client";

import { useState } from "react";
import type { TeamStateView } from "@/lib/game/teamState";

export default function HintButton({
  token,
  state,
  onResult,
}: {
  token: string;
  state: TeamStateView;
  onResult: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  if (!state.game.hintsEnabled) return null;

  if (state.hints.pendingRequest) {
    return (
      <p className="rounded border border-cell-amber/40 bg-cell-amber/5 p-3 text-center text-xs text-cell-amber">
        ▸ Solicitud enviada. Esperen instrucciones.
      </p>
    );
  }

  const request = async () => {
    setSending(true);
    try {
      await fetch("/api/team/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      onResult();
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  return confirming ? (
    <div className="flex gap-2">
      <button
        onClick={request}
        disabled={sending}
        className="flex-1 rounded border border-cell-amber bg-cell-amber/10 p-3 text-xs font-bold tracking-widest text-cell-amber disabled:opacity-40"
      >
        {sending ? "ENVIANDO…" : "CONFIRMAR SOLICITUD"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="flex-1 rounded border border-cell-border p-3 text-xs tracking-widest text-cell-muted"
      >
        CANCELAR
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className="w-full rounded border border-cell-border p-3 text-xs tracking-[0.25em] text-cell-muted transition-colors hover:border-cell-amber hover:text-cell-amber"
    >
      ⚿ SOLICITAR PISTA
    </button>
  );
}
