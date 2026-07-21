# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**CELDA 25 – Cárcel del Quincho**: terminal digital para un escape room presencial (cumpleaños). 2 equipos de 6 jugadores, 4 etapas con códigos, multimedia, mensajes de WhatsApp individuales y panel admin. Especificación completa en el requerimiento original; documentación operativa en `README.md` y `docs/`.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build producción (pasa sin env vars)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (src/**/*.test.ts)
npm run seed:demo    # crea partida demo (requiere .env.local con Supabase)
```

Ejecutar lint + typecheck + test + build antes de cerrar cualquier bloque de trabajo.

## Arquitectura

- **Next.js 15 App Router + TS + Tailwind 4**; deploy en Vercel. Supabase = Postgres + Storage (bucket público `media`) + Realtime.
- **Toda la lógica de juego está en el backend** (`src/app/api/**`) usando el service role key (`src/lib/supabase/admin.ts`). Las tablas tienen **RLS deny-all**: el cliente jamás lee tablas; el anon key solo se usa para suscribirse a canales Realtime de broadcast.
- **Realtime**: el servidor emite pings sin datos (`src/lib/realtime.ts`, endpoint REST `/realtime/v1/api/broadcast`) en `team:{token}` y en un canal admin derivado de `SESSION_SECRET`; los clientes refetchean por API. Fallback: polling suave (15–20 s).
- **Acceso de equipo**: token aleatorio de 32 bytes en `/celda/[token]`, sin login. Se guarda **en claro** en `teams.access_token` (desvío deliberado del spec `access_token_hash`: el admin necesita re-mostrar el QR; con acceso a la DB el hash no aporta).
- **Códigos**: SHA-256 de la forma normalizada (`normalizeCode`: trim, colapso de espacios, mayúsculas, sin tildes). Nunca llegan al cliente. Validación en `src/lib/game/attempts.ts` (intentos por ventana, bloqueo de N minutos, efectos de etapa).
- **Máquina de estados**: `teams.current_phase` ∈ `stage_1_access → stage_2_evidence → stage_3_identity → final_escape → escaped` (`src/lib/game/stateMachine.ts`). Completar la Etapa 2 dispara la tanda de mensajes; completar la final asigna posición y ganador automático.
- **Mensajería**: interfaz `MessagingProvider` (`src/lib/messaging/`), `MockMessagingProvider` (default, estado `simulated`, fallback `wa.me`) y `WhatsAppCloudApiProvider` (Cloud API + plantillas + webhook `/api/webhooks/whatsapp`). Tanda idempotente vía índice único sobre `batch_key + participant_id`.
- **Cronómetro**: derivado de `started_at / paused_at / paused_duration_seconds` con timestamps del servidor (`src/lib/game/timer.ts`); el cliente solo interpola.
- **Admin**: `/admin`, usuario/contraseña por env, cookie HTTP-only firmada HMAC (`src/lib/session.ts`), wrapper `withAdmin` (`src/lib/adminApi.ts`), rate limit en memoria (`src/lib/rateLimit.ts`).
- **Partida singleton**: `ensureGame()` (`src/lib/game/bootstrap.ts`) crea la partida demo completa en el primer acceso admin. Los datos demo van marcados `[DEMO]`; códigos demo en README.

## Decisiones registradas

- **Keys nuevas bajo nombres legacy**: el proyecto real usa el formato nuevo de Supabase (`sb_publishable_...` / `sb_secret_...`). Se guardan bajo las variables existentes `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` sin renombrar ni duplicar: `supabase-js` acepta ambos formatos y así el código no cambia. Verificado contra la instancia real (anon bloqueada por RLS, secret opera).
- RLS deny-all + service role en lugar de políticas por fila: el cliente no toca PostgREST, simplifica y endurece.
- Token de equipo en claro (ver arriba).
- Bucket `media` público: URLs no adivinables, contenido no sensible; simplifica los reproductores.
- Rate limiting en memoria: suficiente para una instancia y 12 jugadores; no sirve multi-instancia.
- `env.ts` accede a variables de forma perezosa para que `next build` pase sin credenciales.
- Broadcast realtime nunca lleva datos del juego, solo eventos (`refresh`, `play_final_audio`, `stop_audio`).

## Convenciones

- Textos de UI en español rioplatense, tono narrativo carcelario (ver componentes existentes).
- Zod valida todos los bodies de API; los códigos que se guardan pasan por `hashCode` y nunca se loguean completos.
- Eventos de auditoría: `logEvent()` en cada acción relevante; tipos listados en `EventsPanel.tsx`.
