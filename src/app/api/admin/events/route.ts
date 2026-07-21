import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame } from "@/lib/game/queries";

/** Historial cronológico filtrable: ?teamId=&type=&limit= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return withAdmin(async () => {
    const game = await getGame();
    if (!game) return { events: [] };
    const db = supabaseAdmin();

    let query = db
      .from("game_events")
      .select("*")
      .eq("game_id", game.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(searchParams.get("limit")) || 200, 500));

    const teamId = searchParams.get("teamId");
    if (teamId) query = query.eq("team_id", teamId);
    const type = searchParams.get("type");
    if (type) query = query.eq("event_type", type);

    const { data, error } = await query;
    if (error) throw error;
    return { events: data ?? [] };
  });
}
