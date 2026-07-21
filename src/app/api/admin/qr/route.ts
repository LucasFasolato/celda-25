import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { withAdmin } from "@/lib/adminApi";
import { getTeamById } from "@/lib/game/queries";
import { env } from "@/lib/env";

/** Devuelve el QR (data URL PNG) y el link de acceso de un equipo. */
export async function GET(req: NextRequest) {
  const teamId = new URL(req.url).searchParams.get("teamId") ?? "";
  return withAdmin(async () => {
    const team = await getTeamById(teamId);
    if (!team) return { error: "team_not_found" };
    const url = `${env.appUrl}/celda/${team.access_token}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 600,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return { ok: true, url, qrDataUrl: dataUrl, teamName: team.name };
  });
}
