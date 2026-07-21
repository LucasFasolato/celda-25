import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { normalizeCode } from "./normalize";

/** Hash de un código de juego sobre su forma normalizada. */
export function hashCode(rawCode: string): string {
  return createHash("sha256").update(`celda25:${normalizeCode(rawCode)}`).digest("hex");
}

/** Compara un intento contra un hash guardado, en tiempo constante. */
export function verifyCode(attempt: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const attemptHash = hashCode(attempt);
  const a = Buffer.from(attemptHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token de acceso de equipo: 32 bytes aleatorios, URL-safe. */
export function generateTeamToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hmacSign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function hmacVerify(value: string, signature: string, secret: string): boolean {
  const expected = hmacSign(value, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
