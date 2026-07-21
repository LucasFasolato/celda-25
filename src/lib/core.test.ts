import { describe, expect, it } from "vitest";
import { normalizeCode, normalizePhone } from "./normalize";
import { generateTeamToken, hashCode, hmacSign, hmacVerify, verifyCode } from "./crypto";
import { isStageCompleted, nextPhase, previousPhase } from "./game/stateMachine";
import { elapsedSeconds, formatDuration } from "./game/timer";
import { MockMessagingProvider, waMeLink } from "./messaging/mock";

describe("normalizeCode", () => {
  it("recorta, colapsa espacios y pasa a mayúsculas", () => {
    expect(normalizeCode("  libertad  25 ")).toBe("LIBERTAD 25");
  });
  it("elimina tildes", () => {
    expect(normalizeCode("fugá rápido")).toBe("FUGA RAPIDO");
  });
  it("no acepta variantes distintas", () => {
    expect(normalizeCode("LIBERTAD25")).not.toBe(normalizeCode("LIBERTAD 25"));
  });
});

describe("normalizePhone", () => {
  it("agrega prefijo argentino", () => {
    expect(normalizePhone("9 11 2233-4455")).toBe("+5491122334455");
  });
  it("respeta E.164 existente", () => {
    expect(normalizePhone("+54 9 11 2233 4455")).toBe("+5491122334455");
  });
});

describe("hashCode/verifyCode", () => {
  it("valida variantes normalizadas del mismo código", () => {
    const hash = hashCode("Código Secreto");
    expect(verifyCode("  codigo   secreto ", hash)).toBe(true);
    expect(verifyCode("codigo secreta", hash)).toBe(false);
  });
  it("rechaza hash vacío", () => {
    expect(verifyCode("lo que sea", "")).toBe(false);
  });
});

describe("tokens y hmac", () => {
  it("genera tokens largos y únicos", () => {
    const a = generateTeamToken();
    const b = generateTeamToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(b);
  });
  it("firma y verifica", () => {
    const sig = hmacSign("payload", "secret");
    expect(hmacVerify("payload", sig, "secret")).toBe(true);
    expect(hmacVerify("payload", sig, "otro")).toBe(false);
  });
});

describe("state machine", () => {
  it("avanza en orden", () => {
    expect(nextPhase("stage_1_access")).toBe("stage_2_evidence");
    expect(nextPhase("stage_3_identity")).toBe("final_escape");
    expect(nextPhase("final_escape")).toBe("escaped");
  });
  it("retrocede", () => {
    expect(previousPhase("stage_2_evidence")).toBe("stage_1_access");
    expect(previousPhase("escaped")).toBe("final_escape");
    expect(previousPhase("stage_1_access")).toBeNull();
  });
  it("marca completadas las etapas anteriores", () => {
    expect(isStageCompleted("stage_1_access", "stage_3_identity")).toBe(true);
    expect(isStageCompleted("final_escape", "stage_3_identity")).toBe(false);
    expect(isStageCompleted("final_escape", "escaped")).toBe(true);
  });
});

describe("timer", () => {
  const start = new Date("2026-07-21T20:00:00Z");
  it("calcula tiempo corriendo", () => {
    const now = new Date("2026-07-21T20:10:30Z");
    expect(
      elapsedSeconds(
        { started_at: start.toISOString(), paused_at: null, paused_duration_seconds: 0, escaped_at: null },
        now
      )
    ).toBe(630);
  });
  it("descuenta pausas y congela en pausa", () => {
    const pausedAt = new Date("2026-07-21T20:05:00Z");
    expect(
      elapsedSeconds(
        {
          started_at: start.toISOString(),
          paused_at: pausedAt.toISOString(),
          paused_duration_seconds: 60,
          escaped_at: null,
        },
        new Date("2026-07-21T21:00:00Z")
      )
    ).toBe(240);
  });
  it("congela al escapar", () => {
    expect(
      elapsedSeconds(
        {
          started_at: start.toISOString(),
          paused_at: null,
          paused_duration_seconds: 0,
          escaped_at: new Date("2026-07-21T20:45:00Z").toISOString(),
        },
        new Date("2026-07-22T10:00:00Z")
      )
    ).toBe(2700);
  });
  it("formatea", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3665)).toBe("1:01:05");
  });
});

describe("MockMessagingProvider", () => {
  it("simula envíos válidos", async () => {
    const result = await new MockMessagingProvider().sendMessage({
      to: "+5491122334455",
      body: "hola",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("simulated");
    expect(result.externalMessageId).toMatch(/^mock-/);
  });
  it("falla con teléfono inválido", async () => {
    const result = await new MockMessagingProvider().sendMessage({ to: "12345", body: "hola" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
  });
  it("genera links wa.me con texto", () => {
    expect(waMeLink("+549112233", "hola juego")).toBe(
      "https://wa.me/549112233?text=hola%20juego"
    );
  });
});
