/**
 * Seed demo: crea (si no existe) la partida completa con datos de ejemplo.
 * Uso: npm run seed:demo  (requiere .env.local con Supabase configurado)
 *
 * Códigos demo (también en README.md):
 *   Etapa 1: DEMO-ACCESO · Etapa 2: DEMO-EVIDENCIA
 *   Etapa 3: DEMO-IDENTIDAD · Final: DEMO-FUGA
 *   Credenciales: DEMO-A1..A6 / DEMO-B1..B6
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Carga .env.local manualmente (sin dependencia de dotenv).
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

async function main() {
  const { ensureGame, DEMO_STAGE_CODES } = await import("../src/lib/game/bootstrap");
  const { supabaseAdmin } = await import("../src/lib/supabase/admin");

  const game = await ensureGame();
  console.log(`✔ Partida lista: ${game.name} (${game.id})`);

  const { data: teams } = await supabaseAdmin()
    .from("teams")
    .select("name, access_token")
    .eq("game_id", game.id);

  console.log("\nCódigos de etapa demo:");
  for (const [stage, code] of Object.entries(DEMO_STAGE_CODES)) {
    console.log(`  ${stage}: ${code}`);
  }
  console.log("\nCredenciales demo: DEMO-A1..A6 y DEMO-B1..B6");
  console.log("\nAccesos de equipo:");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  for (const team of teams ?? []) {
    console.log(`  ${team.name}: ${base}/celda/${team.access_token}`);
  }
  console.log(`\nQR señuelo: ${base}/intervenido`);
  console.log(`Panel admin: ${base}/admin`);
}

main().catch((err) => {
  console.error("Seed falló:", err.message ?? err);
  process.exit(1);
});
