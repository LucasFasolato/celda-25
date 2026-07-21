"use client";

import { useEffect, useState } from "react";

/** QR señuelo: pantalla inmersiva sin pistas ni penalización. */
export default function Intervenido() {
  const [glitching, setGlitching] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const glitchTimer = setTimeout(() => setGlitching(false), 2200);
    const revealTimer = setTimeout(() => setRevealed(true), 5000);
    return () => {
      clearTimeout(glitchTimer);
      clearTimeout(revealTimer);
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <div className={`emergency rounded-full border-2 border-cell-red p-6 ${glitching ? "glitch" : "flicker"}`}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-cell-red">
          <path
            d="M12 3 L22 20 L2 20 Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
      </div>

      <h1 className={`text-3xl font-bold tracking-[0.25em] text-cell-red ${glitching ? "glitch" : ""}`}>
        CANAL INTERVENIDO
      </h1>

      <p className="max-w-md text-sm leading-relaxed text-cell-text">
        Este acceso está vigilado por la Comisaría Fasolato.
        <br />
        No todos los caminos conducen a la salida.
      </p>

      <button
        className="cursor-not-allowed rounded border border-cell-border bg-cell-panel px-6 py-3 text-sm text-cell-muted opacity-50"
        disabled
      >
        SOLICITAR ACCESO
      </button>

      {revealed && (
        <p className="access-granted max-w-md text-xs text-cell-muted">
          Registro archivado. Este canal no contiene información útil. Vuelvan a la celda: la
          verdadera salida está en otra parte.
        </p>
      )}
    </main>
  );
}
