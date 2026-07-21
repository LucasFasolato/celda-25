"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeTopic } from "@/hooks/useRealtimeTopic";
import { adminFetch, type AdminState } from "@/components/admin/types";
import Dashboard from "@/components/admin/Dashboard";
import ConfigPanel from "@/components/admin/ConfigPanel";
import MessagesPanel from "@/components/admin/MessagesPanel";
import EventsPanel from "@/components/admin/EventsPanel";

type Tab = "dashboard" | "config" | "messages" | "events";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<AdminState>("/api/admin/state");
      setState(data);
      setAuthed(true);
    } catch (err) {
      if ((err as { status?: number }).status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeTopic(state?.realtimeTopic ?? null, { refresh: () => refresh() });
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [authed, refresh]);

  if (authed === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="flicker text-sm tracking-widest text-cell-muted">CARGANDO PANEL…</p>
      </main>
    );
  }

  if (!authed) return <LoginForm onSuccess={refresh} />;
  if (!state) return null;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "dashboard", label: "DASHBOARD", badge: state.pendingHints },
    { key: "config", label: "CONFIGURACIÓN" },
    {
      key: "messages",
      label: "MENSAJES",
      badge: state.messages.filter((m) => m.status === "failed").length,
    },
    { key: "events", label: "HISTORIAL" },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-6xl p-4 pb-16">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-cell-border pb-3">
        <div>
          <h1 className="text-lg font-bold tracking-[0.2em] text-cell-amber">
            CELDA 25 · PANEL PENITENCIARIO
          </h1>
          <p className="text-[10px] tracking-widest text-cell-muted">
            MODO MENSAJES: {state.game.messaging_mode === "mock" ? "SIMULADO" : "WHATSAPP REAL"}
            {state.game.messaging_mode === "whatsapp" && !state.whatsappConfigured
              ? " (⚠ SIN CREDENCIALES)"
              : ""}
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            setAuthed(false);
          }}
          className="rounded border border-cell-border px-3 py-1.5 text-xs text-cell-muted hover:text-cell-red"
        >
          CERRAR SESIÓN
        </button>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded border px-4 py-2 text-xs tracking-widest ${
              tab === t.key
                ? "border-cell-amber bg-cell-amber/10 text-cell-amber"
                : "border-cell-border text-cell-muted hover:text-cell-text"
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-2 rounded-full bg-cell-red px-1.5 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <Dashboard state={state} refresh={refresh} />}
      {tab === "config" && <ConfigPanel state={state} refresh={refresh} />}
      {tab === "messages" && <MessagesPanel state={state} refresh={refresh} />}
      {tab === "events" && <EventsPanel state={state} />}
    </main>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) onSuccess();
      else if (res.status === 429) setError("Demasiados intentos. Esperá unos minutos.");
      else setError("Credenciales inválidas.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-lg border border-cell-border bg-cell-panel p-6"
      >
        <h1 className="text-center text-sm font-bold tracking-[0.25em] of text-cell-amber">
          ACCESO PENITENCIARIO
        </h1>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          autoComplete="username"
          className="w-full rounded border border-cell-border bg-cell-bg p-3 text-sm focus:border-cell-amber focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          className="w-full rounded border border-cell-border bg-cell-bg p-3 text-sm focus:border-cell-amber focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !username || !password}
          className="w-full rounded border border-cell-amber bg-cell-amber/10 p-3 text-xs font-bold tracking-[0.25em] text-cell-amber disabled:opacity-40"
        >
          {sending ? "VERIFICANDO…" : "INGRESAR"}
        </button>
        {error && <p className="text-center text-xs text-cell-red">{error}</p>}
      </form>
    </main>
  );
}
