import type { TeamRow } from "@/lib/types";

/**
 * Tiempo transcurrido real de un equipo, derivado de timestamps del servidor.
 * Sobrevive recargas y no depende del reloj del cliente.
 */
export function elapsedSeconds(
  team: Pick<TeamRow, "started_at" | "paused_at" | "paused_duration_seconds" | "escaped_at">,
  now: Date = new Date()
): number {
  if (!team.started_at) return 0;
  const start = new Date(team.started_at).getTime();
  const end = team.escaped_at
    ? new Date(team.escaped_at).getTime()
    : team.paused_at
      ? new Date(team.paused_at).getTime()
      : now.getTime();
  const elapsed = Math.floor((end - start) / 1000) - team.paused_duration_seconds;
  return Math.max(0, elapsed);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
