"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Se suscribe a un canal de broadcast y ejecuta el handler por evento.
 * Los eventos no llevan datos: son pings para refetchear por la API.
 */
export function useRealtimeTopic(
  topic: string | null,
  handlers: Record<string, () => void>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!topic) return;
    const supabase = supabaseBrowser();
    if (!supabase) return;

    const channel = supabase.channel(topic);
    for (const event of Object.keys(handlersRef.current)) {
      channel.on("broadcast", { event }, () => handlersRef.current[event]?.());
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topic]);
}
