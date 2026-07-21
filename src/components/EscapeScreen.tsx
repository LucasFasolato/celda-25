"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TeamStateView } from "@/lib/game/teamState";
import { formatDuration } from "@/lib/game/timer";

export default function EscapeScreen({
  state,
  token,
  audioCommand,
  onAudioCommandHandled,
}: {
  state: TeamStateView;
  token: string;
  audioCommand: "play" | "stop" | null;
  onAudioCommandHandled: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [playing, setPlaying] = useState(false);
  const reported = useRef(false);
  const escape = state.escape!;
  const isWinner = escape.position === 1;

  const playAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setPlaying(true);
        setNeedsInteraction(false);
        if (!reported.current) {
          reported.current = true;
          fetch("/api/team/media-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, kind: "final_audio_played" }),
          }).catch(() => {});
        }
      })
      .catch(() => setNeedsInteraction(true));
  };

  // Intento de autoplay al montar; los navegadores pueden bloquearlo.
  useEffect(() => {
    if (state.media.finalAudioUrl) playAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.media.finalAudioUrl]);

  useEffect(() => {
    if (!audioCommand) return;
    if (audioCommand === "play") playAudio();
    else {
      audioRef.current?.pause();
      setPlaying(false);
    }
    onAudioCommandHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioCommand]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 10) * 0.35}s`,
        duration: `${2.5 + (i % 5) * 0.6}s`,
        color: ["#f5a623", "#46d160", "#e5484d", "#d3d7dc"][i % 4],
      })),
    []
  );

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6 text-center">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
            backgroundColor: c.color,
          }}
        />
      ))}

      {/* Rejas que se abren */}
      <div className="pointer-events-none absolute inset-0 z-10 flex">
        <div className="prison-bars bars-left h-full w-1/2" />
        <div className="prison-bars bars-right h-full w-1/2" />
      </div>

      <div className="relative z-20 flex flex-col items-center gap-5">
        {state.media.finalAudioUrl && (
          <audio ref={audioRef} src={state.media.finalAudioUrl} loop preload="auto" />
        )}

        <p className="text-xs tracking-[0.4em] text-cell-muted">CELDA 25 — CÁRCEL DEL QUINCHO</p>
        <h1 className="access-granted text-4xl font-bold tracking-[0.2em] text-cell-green">
          FUGA COMPLETADA
        </h1>
        <p
          className={`rounded border px-4 py-2 text-sm font-bold tracking-[0.2em] ${
            isWinner
              ? "border-cell-amber text-cell-amber"
              : "border-cell-border text-cell-text"
          }`}
        >
          {isWinner ? "★ PRIMER EQUIPO EN ESCAPAR ★" : "FUGA COMPLETADA"}
        </p>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="TIEMPO" value={formatDuration(state.team.elapsedSeconds)} />
          <Stat label="INTENTOS" value={String(escape.totalAttempts)} />
          <Stat label="PISTAS" value={String(escape.hintsRequested)} />
        </div>

        {state.media.finalAudioUrl && (needsInteraction || !playing) && (
          <button
            onClick={playAudio}
            className="emergency mt-2 rounded border-2 border-cell-amber bg-cell-amber/15 px-8 py-4 text-sm font-bold tracking-[0.25em] text-cell-amber"
          >
            ♪ ACTIVAR SONIDO DE FUGA
          </button>
        )}

        <p className="mt-4 max-w-sm text-xs text-cell-muted">
          {state.team.name} salió de la Cárcel del Quincho. El expediente queda archivado.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-cell-border bg-cell-panel px-4 py-3">
      <p className="text-[10px] tracking-widest text-cell-muted">{label}</p>
      <p className="mt-1 text-lg tabular-nums text-cell-text">{value}</p>
    </div>
  );
}
