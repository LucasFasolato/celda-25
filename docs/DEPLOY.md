# Despliegue: Vercel + Supabase

## 1. Supabase

1. Crear proyecto en https://supabase.com (región `sa-east-1` para Argentina).
2. SQL Editor → ejecutar en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`
3. Verificar en Storage que existe el bucket `media` (público).
4. Settings → API: copiar `URL`, `anon key` y `service_role key`.

## 2. Vercel

1. Importar el repo en https://vercel.com/new (framework: Next.js, sin configuración extra).
2. Cargar las variables de entorno (Production):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secreto) |
   | `NEXT_PUBLIC_APP_URL` | `https://TU-APP.vercel.app` (la URL final) |
   | `ADMIN_USERNAME` | usuario admin |
   | `ADMIN_PASSWORD` | contraseña fuerte |
   | `SESSION_SECRET` | 32+ caracteres aleatorios |
   | `WHATSAPP_*` | vacías hasta configurar Meta (ver WHATSAPP.md) |

3. Deploy. Entrar a `https://TU-APP.vercel.app/admin` — el primer acceso crea la partida demo.

> **Importante:** si cambiás el dominio, actualizá `NEXT_PUBLIC_APP_URL` y regenerá/reimprimí los QR (el link del QR usa esa URL).

## 3. Multimedia

Subir desde el panel admin → Configuración → Multimedia:

- Video Etapa 2 (MP4/WebM, máx. 100 MB).
- Audio Etapa 2 (MP3/WAV/M4A, máx. 30 MB).
- Audio final de fuga (MP3/WAV/M4A, máx. 30 MB).

## 4. QRs físicos

Panel → Dashboard → "Ver QR" en cada equipo → Descargar PNG e imprimir.
El QR verdadero de cada equipo es el que se recorta en fragmentos para la Etapa 1.
El QR señuelo apunta a `https://TU-APP.vercel.app/intervenido` (generarlo con cualquier generador de QR).

## Limitaciones conocidas

- El rate limiting es en memoria: suficiente para una instancia de Vercel con este tráfico (12 jugadores), no para multi-región.
- El bucket `media` es público (URLs no listables). No subir contenido sensible.
