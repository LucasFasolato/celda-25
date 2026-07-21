# CELDA 25 – Cárcel del Quincho

Terminal digital para un escape room presencial de cumpleaños: 2 equipos de 6 jugadores, 4 etapas con validación de códigos en backend, multimedia, mensajes individuales por WhatsApp (con modo simulado), panel de administración y sincronización en tiempo real.

## Stack

- **Next.js 15** (App Router, TypeScript) — frontend + backend en un solo despliegue (Vercel).
- **Supabase** — Postgres, Storage (multimedia) y Realtime (broadcast).
- **Tailwind CSS 4** — estética carcelaria oscura, mobile-first.

## Instalación local

1. Cloná el repo e instalá dependencias:

   ```bash
   npm install
   ```

2. Creá un proyecto en [Supabase](https://supabase.com) y ejecutá las migraciones en el SQL Editor, en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`

3. Copiá `.env.example` a `.env.local` y completá:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Settings → API del proyecto).
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` (inventá valores seguros).
   - Las variables `WHATSAPP_*` quedan vacías hasta configurar Meta (ver `docs/WHATSAPP.md`).

4. Levantá la app y sembrá los datos demo:

   ```bash
   npm run dev
   npm run seed:demo   # en otra terminal; imprime links y códigos demo
   ```

5. Entrá a `http://localhost:3000/admin` con tu usuario y contraseña. El panel crea la partida demo automáticamente en el primer acceso si no corriste el seed.

## Datos demo

Todo lo marcado `[DEMO]` se reemplaza desde el panel antes del evento.

| Qué | Código demo |
| --- | --- |
| Etapa 1 (Acceso clandestino) | `DEMO-ACCESO` |
| Etapa 2 (Registro de vigilancia) | `DEMO-EVIDENCIA` |
| Etapa 3 (Identificación) | `DEMO-IDENTIDAD` |
| Código final (Fuga) | `DEMO-FUGA` |
| Credenciales Equipo A | `DEMO-A1` … `DEMO-A6` |
| Credenciales Equipo B | `DEMO-B1` … `DEMO-B6` |

Los códigos se normalizan (mayúsculas, tildes, espacios): `demo-acceso` también funciona.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Desarrollo local |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm test` | Tests unitarios (Vitest) |
| `npm run seed:demo` | Crea la partida demo e imprime links/códigos |

## Rutas

- `/celda/[token]` — terminal del equipo (se accede por QR; sin login).
- `/intervenido` — QR señuelo ("Canal intervenido").
- `/admin` — panel de administración (usuario/contraseña).
- `/api/webhooks/whatsapp` — webhook de estados de WhatsApp Cloud API.

## Documentación

- `docs/DEPLOY.md` — despliegue en Vercel + Supabase.
- `docs/WHATSAPP.md` — configuración de WhatsApp Business Cloud API.
- `docs/CHECKLIST.md` — checklist de prueba completa antes del cumpleaños.
- `CLAUDE.md` — arquitectura y decisiones técnicas.
