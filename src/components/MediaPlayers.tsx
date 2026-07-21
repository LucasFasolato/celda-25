"use client";

import { useRef, useState } from "react";
import type { TeamStateView } from "@/lib/game/teamState";

function reportPlayback(token: string, kind: "video_played" | "audio_played") {
  fetch("/api/team/media-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, kind }),
  }).catch(() => {});
}

export default function MediaPlayers({
  token,
  state,
}: {
  token: string;
  state: TeamStateView;
}) {
  const videoReported = useRef(false);
  const audioReported = useRef(false);
  const [videoError, setVideoError] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs tracking-widest text-cell-muted">▸ ARCHIVO DE VIDEO</p>
        {state.media.videoUrl ? (
          videoError ? (
            <div className="rounded border border-cell-red/50 bg-cell-red/10 p-3 text-center">
              <p className="mb-2 text-xs text-cell-red">El archivo de video no pudo cargarse.</p>
              <button
                onClick={() => {
                  setVideoError(false);
                  setVideoKey((k) => k + 1);
                }}
                className="rounded border border-cell-amber px-4 py-2 text-xs text-cell-amber"
              >
                REINTENTAR
              </button>
            </div>
          ) : (
            <video
              key={videoKey}
              src={state.media.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded border border-cell-border bg-black"
              onPlay={() => {
                if (!videoReported.current) {
                  videoReported.current = true;
                  reportPlayback(token, "video_played");
                }
              }}
              onError={() => setVideoError(true)}
            />
          )
        ) : (
          <p className="rounded border border-dashed border-cell-border p-3 text-xs text-cell-muted">
            No hay video cargado todavía. El penitenciario debe subirlo desde el panel.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs tracking-widest text-cell-muted">▸ ARCHIVO DE AUDIO</p>
        {state.media.audioUrl ? (
          <audio
            src={state.media.audioUrl}
            controls
            preload="metadata"
            className="w-full"
            onPlay={() => {
              if (!audioReported.current) {
                audioReported.current = true;
                reportPlayback(token, "audio_played");
              }
            }}
          />
        ) : (
          <p className="rounded border border-dashed border-cell-border p-3 text-xs text-cell-muted">
            No hay audio cargado todavía.
          </p>
        )}
      </div>
    </div>
  );
}
