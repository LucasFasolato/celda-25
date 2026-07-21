import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError } from "./session";

/** Envuelve un handler admin: exige sesión y uniformiza errores. */
export function withAdmin<T>(
  handler: (adminUser: string) => Promise<T>
): Promise<NextResponse> {
  return requireAdmin()
    .then(async (user) => NextResponse.json((await handler(user)) as object))
    .catch((err) => {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      console.error("Error en API admin:", err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    });
}
