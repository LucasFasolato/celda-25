"use client";

import { useState } from "react";
import { adminFetch, type AdminState, type AdminMessage } from "./types";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "PENDIENTE", cls: "text-cell-amber" },
  sent: { label: "ENVIADO", cls: "text-cell-green" },
  delivered: { label: "ENTREGADO", cls: "text-cell-green" },
  read: { label: "LEÍDO", cls: "text-cell-green" },
  failed: { label: "FALLIDO", cls: "text-cell-red" },
  simulated: { label: "SIMULADO", cls: "text-cell-amber" },
};

export default function MessagesPanel({
  state,
  refresh,
}: {
  state: AdminState;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState<{ message: AdminMessage; mode: "edit" | "resend" } | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? "?";

  const act = async (payload: object) => {
    setBusy(true);
    try {
      await adminFetch("/api/admin/messages", { method: "POST", body: JSON.stringify(payload) });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const openWa = async (message: AdminMessage) => {
    const data = await adminFetch<{ link?: string }>("/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ action: "wa_link", messageId: message.id }),
    });
    if (data.link) window.open(data.link, "_blank");
  };

  // Jugadores sin ningún mensaje todavía (envío inicial manual).
  const playersWithoutMessages = state.teams.flatMap((team) =>
    team.players
      .filter((p) => !state.messages.some((m) => m.participant_id === p.id))
      .map((p) => ({ ...p, teamName: team.name }))
  );

  return (
    <div className="space-y-4">
      {state.game.messaging_mode === "mock" && (
        <p className="rounded border border-cell-amber/40 bg-cell-amber/5 p-3 text-xs text-cell-amber">
          Modo SIMULADO activo: los mensajes se registran pero no se envían. Usá &quot;Copiar&quot; o
          &quot;WhatsApp manual&quot; para mandarlos desde tu teléfono, o activá el modo real en
          Configuración cuando Meta esté listo.
        </p>
      )}

      {playersWithoutMessages.length > 0 && (
        <section className="rounded-lg border border-cell-border bg-cell-panel p-4">
          <h3 className="mb-2 text-xs font-bold tracking-[0.25em] text-cell-amber">
            SIN MENSAJE TODAVÍA
          </h3>
          <div className="flex flex-wrap gap-2">
            {playersWithoutMessages.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => act({ action: "send", participantId: p.id })}
                className="rounded border border-cell-border px-3 py-1.5 text-xs text-cell-muted hover:border-cell-amber hover:text-cell-amber disabled:opacity-40"
              >
                Enviar a {p.name} ({p.teamName})
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-cell-border">
        <table className="w-full min-w-[900px] bg-cell-panel text-left text-xs">
          <thead>
            <tr className="border-b border-cell-border text-[10px] tracking-widest text-cell-muted">
              <th className="p-2">EQUIPO</th>
              <th className="p-2">JUGADOR</th>
              <th className="p-2">TELÉFONO</th>
              <th className="p-2">ESTADO</th>
              <th className="p-2">ENVIADO</th>
              <th className="p-2">ENTREGADO</th>
              <th className="p-2">ERROR</th>
              <th className="p-2">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {state.messages.map((message) => {
              const status = STATUS_LABELS[message.status] ?? { label: message.status, cls: "" };
              return (
                <tr key={message.id} className="border-b border-cell-border/50 align-top">
                  <td className="p-2">{teamName(message.team_id)}</td>
                  <td className="p-2">
                    {message.participantName}
                    {message.is_resend && <span className="ml-1 text-cell-muted">(reenvío)</span>}
                    <span className="ml-1 text-cell-muted">v{message.message_version}</span>
                  </td>
                  <td className="p-2">{message.participantPhone || "—"}</td>
                  <td className={`p-2 font-bold ${status.cls}`}>{status.label}</td>
                  <td className="p-2">
                    {message.sent_at ? new Date(message.sent_at).toLocaleTimeString("es-AR") : "—"}
                  </td>
                  <td className="p-2">
                    {message.delivered_at
                      ? new Date(message.delivered_at).toLocaleTimeString("es-AR")
                      : "—"}
                  </td>
                  <td className="max-w-[160px] p-2 text-cell-red">{message.error_message ?? ""}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {!message.sent_at && ["pending", "failed"].includes(message.status) && (
                        <MiniBtn
                          label="Editar"
                          onClick={() => {
                            setEditing({ message, mode: "edit" });
                            setBody(message.message_body);
                          }}
                        />
                      )}
                      <MiniBtn
                        label="Reenviar"
                        onClick={() => {
                          setEditing({ message, mode: "resend" });
                          setBody(message.message_body);
                        }}
                      />
                      <MiniBtn
                        label="Copiar"
                        onClick={() => navigator.clipboard.writeText(message.message_body)}
                      />
                      <MiniBtn label="WhatsApp manual" onClick={() => openWa(message)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {state.messages.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-cell-muted">
                  Todavía no hay mensajes. La tanda se dispara al validar la Etapa 2, o podés
                  enviarlos manualmente arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg border border-cell-border bg-cell-panel p-5">
            <h3 className="text-xs font-bold tracking-[0.25em] text-cell-amber">
              {editing.mode === "edit" ? "EDITAR MENSAJE" : "REENVIAR MENSAJE"} —{" "}
              {editing.message.participantName}
            </h3>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded border border-cell-border bg-cell-bg p-3 text-sm focus:border-cell-amber focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                disabled={busy || !body.trim()}
                onClick={async () => {
                  if (editing.mode === "edit") {
                    await act({ action: "edit", messageId: editing.message.id, body });
                  } else {
                    await act({
                      action: "resend",
                      messageId: editing.message.id,
                      body: body !== editing.message.message_body ? body : undefined,
                    });
                  }
                  setEditing(null);
                }}
                className="flex-1 rounded border border-cell-amber bg-cell-amber/10 p-2.5 text-xs font-bold tracking-widest text-cell-amber disabled:opacity-40"
              >
                {editing.mode === "edit" ? "GUARDAR" : "REENVIAR AHORA"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded border border-cell-border p-2.5 text-xs text-cell-muted"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-cell-border px-2 py-1 text-[10px] text-cell-muted hover:border-cell-amber hover:text-cell-amber"
    >
      {label}
    </button>
  );
}
