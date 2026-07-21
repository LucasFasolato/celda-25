import { cookies } from "next/headers";
import { hmacSign, hmacVerify } from "./crypto";
import { env } from "./env";

const COOKIE_NAME = "celda25_admin";
const SESSION_HOURS = 12;

interface SessionPayload {
  user: string;
  exp: number;
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSign(body, env.sessionSecret)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!hmacVerify(body, signature, env.sessionSecret)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createAdminSession(user: string) {
  const token = encode({ user, exp: Date.now() + SESSION_HOURS * 3600_000 });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Devuelve el usuario admin autenticado o null. */
export async function getAdminUser(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token)?.user ?? null;
}

/** Lanza (respuesta 401 en el handler) si no hay sesión admin. */
export async function requireAdmin(): Promise<string> {
  const user = await getAdminUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("No autorizado");
  }
}
