// Smoke test funcional contra el servidor real + Supabase real.
// No imprime tokens ni secretos. Uso: node scripts/smoke.mjs
import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SH = { apikey: key, Authorization: "Bearer " + key };

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else fail++; console.log(`  ${cond ? "✓" : "✗ FALLA"} ${label}`); return cond; };
const j = async (r) => { try { return await r.json(); } catch { return null; } };

// --- helpers admin (cookie de sesión HMAC) ---
let cookie = "";
async function admin(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(opts.headers || {}) },
  });
  return r;
}
async function team(path, body) {
  return fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
// Lectura directa a la DB con service role (para tokens/estado interno, no expuestos por API pública).
const db = async (t, q) => (await fetch(`${url}/rest/v1/${t}?${q}`, { headers: SH })).json();

async function main() {
  console.log("\n### 1. ADMIN: login");
  let r = await fetch(BASE + "/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
  });
  ok(r.ok, "login admin");
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  ok(cookie.startsWith("celda25_admin="), "cookie de sesión HMAC emitida");

  r = await admin("/api/admin/login", { method: "DELETE" });
  // re-login para seguir
  r = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];

  console.log("\n### 1b. ADMIN: state carga partida + no expone secretos");
  let st = await j(await admin("/api/admin/state"));
  ok(st?.teams?.length === 2, "dashboard con 2 equipos");
  const rawState = JSON.stringify(st);
  ok(!/correct_code_hash|credential_code_hash/.test(rawState), "state NO expone hashes de códigos");
  ok(!/sb_secret|service_role/.test(rawState), "state NO expone la clave privada");
  ok(st.game.messaging_mode === "mock", "modo de mensajes = mock (simulado)");
  const teamA = st.teams.find((t) => t.name === "Pabellón A");
  const teamB = st.teams.find((t) => t.name === "Pabellón B");

  console.log("\n### 1c. ADMIN: configurar códigos reales de etapa (reemplazan DEMO)");
  r = await admin("/api/admin/config", { method: "PUT", body: JSON.stringify({
    stageCodes: [
      { stageKey: "stage_1_access", code: "LIBERTAD-1" },
      { stageKey: "stage_2_evidence", code: "VIGILANCIA-2" },
      { stageKey: "stage_3_identity", code: "IDENTIDAD-3" },
      { stageKey: "final_escape", code: "FUGA-FINAL" },
    ],
  })});
  ok((await j(r))?.ok, "códigos de etapa guardados (hash)");

  console.log("\n### 1d. ADMIN: editar nombre de equipo y teléfono de un jugador");
  const pA = teamA.players[0];
  r = await admin("/api/admin/config", { method: "PUT", body: JSON.stringify({
    participants: [{ id: pA.id, phone: "11 2233 4455", role: "Cabecilla" }],
  })});
  ok((await j(r))?.ok, "jugador editado (teléfono normalizado a E.164 en backend)");
  const pDb = (await db("participants", `id=eq.${pA.id}&select=phone_e164`))[0];
  ok(pDb.phone_e164 === "+5491122334455", "teléfono normalizado correctamente en DB");

  console.log("\n### 1e. ADMIN: generar QR de equipo");
  r = await j(await admin(`/api/admin/qr?teamId=${teamA.id}`));
  ok(r?.qrDataUrl?.startsWith("data:image/png;base64,"), "QR PNG generado");

  // Tokens (solo para el flujo; no se imprimen)
  const tokens = Object.fromEntries((await db("teams", "select=id,access_token")).map((t) => [t.id, t.access_token]));
  const tokA = tokens[teamA.id], tokB = tokens[teamB.id];

  console.log("\n### 2. ADMIN: iniciar partida completa (ambos equipos)");
  r = await admin("/api/admin/game-action", { method: "POST", body: JSON.stringify({ action: "start_all" }) });
  ok((await j(r))?.ok, "start_all");
  st = await j(await admin("/api/admin/state"));
  ok(st.teams.every((t) => t.status === "in_game"), "ambos equipos en juego");

  console.log("\n### 3. EQUIPO A: acceso por token válido");
  let sA = await j(await team("/api/team/state", { token: tokA, firstLoad: true }));
  ok(sA?.team?.name === "Pabellón A", "acceso equipo A OK");
  ok(!JSON.stringify(sA).match(/hash|access_token|phone_e164/), "state de equipo NO expone hashes/teléfonos/token");

  console.log("\n### 3b. Token inválido -> acceso denegado");
  r = await team("/api/team/state", { token: "token-invalido-xxxxxxxxxxxxxxxx", firstLoad: false });
  ok(r.status === 403, "token inválido rechazado (403)");

  console.log("\n### 4. EQUIPO A: Etapa 1 — 5 intentos incorrectos -> bloqueo");
  let lastOutcome;
  for (let i = 1; i <= 5; i++) {
    const a = await j(await team("/api/team/attempt", { token: tokA, stageKey: "stage_1_access", code: "MAL-" + i }));
    lastOutcome = a;
    if (i < 5) console.log(`     intento ${i}: ${a.outcome} (restantes=${a.attemptsRemaining})`);
  }
  ok(lastOutcome.outcome === "locked", "5º intento genera bloqueo");
  ok(!!lastOutcome.lockedUntil, "hay lockedUntil");
  const a6 = await j(await team("/api/team/attempt", { token: tokA, stageKey: "stage_1_access", code: "LIBERTAD-1" }));
  ok(a6.outcome === "locked", "código correcto durante bloqueo = sigue bloqueado (no avanza)");

  console.log("\n### 5. ADMIN: quitar bloqueo");
  r = await admin("/api/admin/team-action", { method: "POST", body: JSON.stringify({ teamId: teamA.id, action: "clear_lockout" }) });
  ok((await j(r))?.ok, "clear_lockout");

  console.log("\n### 6. EQUIPO A: Etapa 1 código correcto -> avanza a Etapa 2");
  const c1 = await j(await team("/api/team/attempt", { token: tokA, stageKey: "stage_1_access", code: " libertad-1 " }));
  ok(c1.outcome === "correct" && c1.newPhase === "stage_2_evidence", "Etapa 1 correcta (código normalizado), avanza a Etapa 2");

  console.log("\n### 7. EQUIPO A: solicitar pista + admin responde");
  r = await team("/api/team/hint", { token: tokA });
  ok((await j(r)).outcome === "created", "pista solicitada");
  st = await j(await admin("/api/admin/state"));
  const hint = st.hints.find((h) => h.team_id === teamA.id && h.status === "pending");
  ok(!!hint, "solicitud aparece en dashboard admin");
  r = await admin("/api/admin/hints", { method: "POST", body: JSON.stringify({ hintId: hint.id, action: "respond_screen", responseText: "Miren debajo del banco." }) });
  ok((await j(r))?.ok, "admin responde a pantalla");
  sA = await j(await team("/api/team/state", { token: tokA }));
  ok(sA.hints.responses.some((x) => x.text.includes("banco")), "respuesta visible en pantalla del equipo");

  console.log("\n### 8. EQUIPO A: Etapa 2 correcta -> dispara tanda de 6 mensajes");
  const c2 = await j(await team("/api/team/attempt", { token: tokA, stageKey: "stage_2_evidence", code: "VIGILANCIA-2" }));
  ok(c2.outcome === "correct" && c2.newPhase === "stage_3_identity", "Etapa 2 correcta, avanza a Etapa 3");
  let msgsA = await db("outbound_messages", `team_id=eq.${teamA.id}&select=id,status,participant_id`);
  ok(msgsA.length === 6, `tanda generó 6 mensajes (=${msgsA.length})`);
  ok(msgsA.every((m) => m.status === "simulated"), "los 6 mensajes quedaron 'simulated' (modo mock)");

  console.log("\n### 8b. IDEMPOTENCIA: re-avanzar no duplica la tanda");
  // Forzamos re-ejecución del efecto llamando complete_stage sobre etapa ya pasada no aplica;
  // en su lugar verificamos el índice único intentando reinsertar el mismo batch.
  const dup = await fetch(`${url}/rest/v1/outbound_messages`, { method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ participant_id: msgsA[0].participant_id, team_id: teamA.id, batch_key: `stage3:${teamA.id}`, message_body: "dup", status: "pending" }) });
  ok(dup.status === 409, "índice único batch_key rechaza duplicado (409)");
  msgsA = await db("outbound_messages", `team_id=eq.${teamA.id}&select=id`);
  ok(msgsA.length === 6, "siguen siendo 6 mensajes (sin duplicar)");

  console.log("\n### 9. EQUIPO A: validar 6 credenciales");
  let found = 0;
  for (let i = 1; i <= 6; i++) {
    const cr = await j(await team("/api/team/credential", { token: tokA, code: `DEMO-A${i}` }));
    if (cr.outcome === "found") found = cr.found;
  }
  ok(found === 6, `6/6 credenciales validadas (=${found})`);
  // reuso de credencial ya usada
  const reuse = await j(await team("/api/team/credential", { token: tokA, code: "DEMO-A1" }));
  ok(reuse.outcome === "already_used", "credencial reusada = already_used (no re-cuenta)");

  console.log("\n### 9b. Etapa 3: código antes de 6/6 se bloquea (probado ahora con 6/6 disponible)");
  const c3 = await j(await team("/api/team/attempt", { token: tokA, stageKey: "stage_3_identity", code: "IDENTIDAD-3" }));
  ok(c3.outcome === "correct" && c3.newPhase === "final_escape", "Etapa 3 correcta, avanza a código final");

  console.log("\n### 10. EQUIPO A: código final -> fuga + ganador automático");
  const cf = await j(await team("/api/team/attempt", { token: tokA, stageKey: "final_escape", code: "FUGA-FINAL" }));
  ok(cf.outcome === "correct" && cf.escaped?.position === 1, "fuga completada, posición 1");
  st = await j(await admin("/api/admin/state"));
  const tA2 = st.teams.find((t) => t.id === teamA.id);
  ok(tA2.isWinner === true, "Equipo A marcado como GANADOR automático");
  ok(tA2.currentPhase === "escaped", "fase = escaped");

  console.log("\n### 11. INDEPENDENCIA: Equipo B intacto mientras A ganó");
  const tB2 = st.teams.find((t) => t.id === teamB.id);
  ok(tB2.currentPhase === "stage_1_access", "Equipo B sigue en Etapa 1 (no avanzó)");
  ok(tB2.credentialsFound === 0, "Equipo B con 0 credenciales (no recibió las de A)");
  ok(tB2.messagesSent === 0, "Equipo B sin mensajes (no recibió los de A)");
  ok(tB2.isWinner === false, "Equipo B no es ganador");
  const msgsB = await db("outbound_messages", `team_id=eq.${teamB.id}&select=id`);
  ok(msgsB.length === 0, "Equipo B: 0 mensajes en DB");

  console.log("\n### 12. Equipo B termina después -> segunda posición sin alterar ganador");
  for (const [stage, code] of [["stage_1_access","LIBERTAD-1"],["stage_2_evidence","VIGILANCIA-2"]]) {
    await team("/api/team/attempt", { token: tokB, stageKey: stage, code });
  }
  for (let i = 1; i <= 6; i++) await team("/api/team/credential", { token: tokB, code: `DEMO-B${i}` });
  await team("/api/team/attempt", { token: tokB, stageKey: "stage_3_identity", code: "IDENTIDAD-3" });
  const cfB = await j(await team("/api/team/attempt", { token: tokB, stageKey: "final_escape", code: "FUGA-FINAL" }));
  ok(cfB.escaped?.position === 2, "Equipo B escapa en posición 2");
  st = await j(await admin("/api/admin/state"));
  ok(st.teams.find((t) => t.id === teamA.id).isWinner === true, "Equipo A SIGUE siendo el ganador (no lo alteró B)");
  ok(st.teams.find((t) => t.id === teamB.id).isWinner === false, "Equipo B no es ganador");

  console.log("\n### 13. HISTORIAL: eventos registrados");
  const ev = await j(await admin("/api/admin/events?limit=500"));
  const types = new Set(ev.events.map((e) => e.event_type));
  for (const t of ["team_started","code_incorrect","lockout_started","lockout_cleared","code_correct","hint_requested","hint_responded","message_sent","credential_validated","stage_completed","escape_completed","winner_assigned"])
    ok(types.has(t), `evento '${t}' registrado`);

  console.log(`\n=== RESULTADO: ${pass} OK, ${fail} FALLAS ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
