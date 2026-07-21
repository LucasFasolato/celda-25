"use client";

import { useState } from "react";
import { adminFetch, type AdminState, type AdminPlayer } from "./types";

const STAGE_LABELS: Record<string, string> = {
  stage_1_access: "Código Etapa 1 (Acceso clandestino)",
  stage_2_evidence: "Código Etapa 2 (Registro de vigilancia)",
  stage_3_identity: "Código Etapa 3 (Identificación)",
  final_escape: "Código final (Fuga)",
};

export default function ConfigPanel({
  state,
  refresh,
}: {
  state: AdminState;
  refresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <GameSettings state={state} refresh={refresh} />
      <StageCodes state={state} refresh={refresh} />
      <MediaUploads state={state} refresh={refresh} />
      {state.teams.map((team) => (
        <TeamEditor key={team.id} state={state} teamId={team.id} refresh={refresh} />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-cell-border bg-cell-panel p-4">
      <h3 className="mb-3 text-xs font-bold tracking-[0.25em] text-cell-amber">{title}</h3>
      {children}
    </section>
  );
}

function GameSettings({ state, refresh }: { state: AdminState; refresh: () => void }) {
  const [name, setName] = useState(state.game.name);
  const [description, setDescription] = useState(state.game.description);
  const [maxAttempts, setMaxAttempts] = useState(state.game.max_attempts);
  const [lockoutMinutes, setLockoutMinutes] = useState(state.game.lockout_minutes);
  const [messagingMode, setMessagingMode] = useState(state.game.messaging_mode);
  const [hintsEnabled, setHintsEnabled] = useState(state.game.hints_enabled);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await adminFetch("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({
        game: { name, description, maxAttempts, lockoutMinutes, messagingMode, hintsEnabled },
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  };

  return (
    <Section title="PARTIDA">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-cell-muted">
          Título
          <input value={name} onChange={(e) => setName(e.target.value)} className={input()} />
        </label>
        <label className="text-xs text-cell-muted">
          Descripción
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={input()}
          />
        </label>
        <label className="text-xs text-cell-muted">
          Máximo de intentos por ventana
          <input
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            className={input()}
          />
        </label>
        <label className="text-xs text-cell-muted">
          Minutos de bloqueo
          <input
            type="number"
            min={1}
            max={60}
            value={lockoutMinutes}
            onChange={(e) => setLockoutMinutes(Number(e.target.value))}
            className={input()}
          />
        </label>
        <label className="text-xs text-cell-muted">
          Modo de mensajes
          <select
            value={messagingMode}
            onChange={(e) => setMessagingMode(e.target.value as "mock" | "whatsapp")}
            className={input()}
          >
            <option value="mock">Simulado (sin Meta)</option>
            <option value="whatsapp">WhatsApp Cloud API real</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs text-cell-muted">
          <input
            type="checkbox"
            checked={hintsEnabled}
            onChange={(e) => setHintsEnabled(e.target.checked)}
          />
          Pistas habilitadas
        </label>
      </div>
      <SaveButton onClick={save} saved={saved} />
    </Section>
  );
}

function StageCodes({ state, refresh }: { state: AdminState; refresh: () => void }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const stageCodes = Object.entries(codes)
      .filter(([, code]) => code.trim())
      .map(([stageKey, code]) => ({ stageKey, code }));
    if (!stageCodes.length) return;
    await adminFetch("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ stageCodes }),
    });
    setCodes({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  };

  return (
    <Section title="CÓDIGOS DE ETAPA">
      <p className="mb-3 text-[11px] text-cell-muted">
        Los códigos se guardan como hash: no se pueden volver a ver, solo reemplazar. Un campo
        vacío mantiene el código actual.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {state.stages.map((stage) => (
          <label key={stage.stageKey} className="text-xs text-cell-muted">
            {STAGE_LABELS[stage.stageKey] ?? stage.name}{" "}
            {stage.codeConfigured ? (
              <span className="text-cell-green">✓ configurado</span>
            ) : (
              <span className="text-cell-red">✗ pendiente</span>
            )}
            <input
              value={codes[stage.stageKey] ?? ""}
              onChange={(e) => setCodes({ ...codes, [stage.stageKey]: e.target.value })}
              placeholder="Nuevo código…"
              className={input()}
            />
          </label>
        ))}
      </div>
      <SaveButton onClick={save} saved={saved} />
    </Section>
  );
}

function MediaUploads({ state, refresh }: { state: AdminState; refresh: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (assetType: string, file: File) => {
    setUploading(assetType);
    setError(null);
    try {
      const form = new FormData();
      form.append("assetType", assetType);
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) setError(`Error: ${data.error} ${data.details ?? ""}`);
      refresh();
    } catch {
      setError("Fallo la subida.");
    } finally {
      setUploading(null);
    }
  };

  const slots = [
    { type: "stage2_video", label: "Video Etapa 2", accept: "video/mp4,video/webm" },
    { type: "stage2_audio", label: "Audio Etapa 2", accept: "audio/*" },
    { type: "final_audio", label: "Audio final (fuga)", accept: "audio/*" },
  ];

  return (
    <Section title="MULTIMEDIA">
      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const asset = state.media.find((m) => m.asset_type === slot.type);
          return (
            <div key={slot.type} className="rounded border border-cell-border p-3 text-xs">
              <p className="mb-1 text-cell-muted">{slot.label}</p>
              <p className="mb-2">
                {asset ? (
                  <span className="text-cell-green">✓ {asset.mime_type}</span>
                ) : (
                  <span className="text-cell-red">✗ pendiente</span>
                )}
              </p>
              <input
                type="file"
                accept={slot.accept}
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(slot.type, file);
                }}
                className="w-full text-[10px]"
              />
              {uploading === slot.type && <p className="mt-1 text-cell-amber">Subiendo…</p>}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-cell-red">{error}</p>}
    </Section>
  );
}

function TeamEditor({
  state,
  teamId,
  refresh,
}: {
  state: AdminState;
  teamId: string;
  refresh: () => void;
}) {
  const team = state.teams.find((t) => t.id === teamId)!;
  const [name, setName] = useState(team.name);
  const [players, setPlayers] = useState<Record<string, Partial<AdminPlayer> & { credentialCode?: string }>>({});
  const [saved, setSaved] = useState(false);

  const setPlayer = (id: string, patch: Partial<AdminPlayer> & { credentialCode?: string }) =>
    setPlayers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async () => {
    const participants = Object.entries(players).map(([id, patch]) => ({
      id,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.role !== undefined && { role: patch.role }),
      ...(patch.credentialCode ? { credentialCode: patch.credentialCode } : {}),
      ...(patch.privateMessage !== undefined && { privateMessage: patch.privateMessage }),
      ...(patch.privateMission !== undefined && { privateMission: patch.privateMission }),
      ...(patch.clueLocation !== undefined && { clueLocation: patch.clueLocation }),
      ...(patch.messageEnabled !== undefined && { messageEnabled: patch.messageEnabled }),
    }));
    await adminFetch("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({
        teams: name !== team.name ? [{ id: team.id, name }] : undefined,
        participants: participants.length ? participants : undefined,
      }),
    });
    setPlayers({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  };

  return (
    <Section title={`EQUIPO: ${team.name.toUpperCase()}`}>
      <label className="text-xs text-cell-muted">
        Nombre del equipo
        <input value={name} onChange={(e) => setName(e.target.value)} className={input()} />
      </label>
      <div className="mt-3 space-y-3">
        {team.players.map((player) => {
          const draft = players[player.id] ?? {};
          return (
            <details key={player.id} className="rounded border border-cell-border p-3">
              <summary className="cursor-pointer text-xs text-cell-text">
                {draft.name ?? player.name}{" "}
                <span className="text-cell-muted">
                  · {player.credentialConfigured ? "credencial ✓" : "credencial ✗"}
                  {player.credentialFound ? " · localizado" : ""}
                </span>
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Nombre" value={draft.name ?? player.name} onChange={(v) => setPlayer(player.id, { name: v })} />
                <Field
                  label="Teléfono (+54 9 …)"
                  value={draft.phone ?? player.phone}
                  onChange={(v) => setPlayer(player.id, { phone: v })}
                />
                <Field label="Rol / identidad" value={draft.role ?? player.role} onChange={(v) => setPlayer(player.id, { role: v })} />
                <Field
                  label="Código de credencial (reemplaza el actual)"
                  value={draft.credentialCode ?? ""}
                  onChange={(v) => setPlayer(player.id, { credentialCode: v })}
                  placeholder={player.credentialConfigured ? "•••• configurado" : "pendiente"}
                />
                <Field
                  label="Pista del escondite"
                  value={draft.clueLocation ?? player.clueLocation}
                  onChange={(v) => setPlayer(player.id, { clueLocation: v })}
                />
                <Field
                  label="Misión privada"
                  value={draft.privateMission ?? player.privateMission}
                  onChange={(v) => setPlayer(player.id, { privateMission: v })}
                />
                <label className="text-xs text-cell-muted sm:col-span-2">
                  Mensaje individual de WhatsApp (vacío = mensaje generado automáticamente)
                  <textarea
                    rows={4}
                    value={draft.privateMessage ?? player.privateMessage}
                    onChange={(e) => setPlayer(player.id, { privateMessage: e.target.value })}
                    className={input()}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-cell-muted">
                  <input
                    type="checkbox"
                    checked={draft.messageEnabled ?? player.messageEnabled}
                    onChange={(e) => setPlayer(player.id, { messageEnabled: e.target.checked })}
                  />
                  Mensaje habilitado en la tanda
                </label>
              </div>
            </details>
          );
        })}
      </div>
      <SaveButton onClick={save} saved={saved} />
    </Section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-xs text-cell-muted">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input()} />
    </label>
  );
}

function SaveButton({ onClick, saved }: { onClick: () => void; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 rounded border border-cell-amber bg-cell-amber/10 px-4 py-2 text-xs font-bold tracking-widest text-cell-amber"
    >
      {saved ? "✓ GUARDADO" : "GUARDAR"}
    </button>
  );
}

function input() {
  return "mt-1 w-full rounded border border-cell-border bg-cell-bg p-2 text-sm text-cell-text focus:border-cell-amber focus:outline-none";
}
