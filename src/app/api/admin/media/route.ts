import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/adminApi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGame, logEvent } from "@/lib/game/queries";
import { notifyAdmin } from "@/lib/realtime";

const ALLOWED: Record<string, { mimes: string[]; maxBytes: number }> = {
  stage2_video: {
    mimes: ["video/mp4", "video/webm"],
    maxBytes: 100 * 1024 * 1024,
  },
  stage2_audio: {
    mimes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/aac"],
    maxBytes: 30 * 1024 * 1024,
  },
  final_audio: {
    mimes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/aac"],
    maxBytes: 30 * 1024 * 1024,
  },
};

/** Sube video/audio a Supabase Storage y registra el asset. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  return withAdmin(async (adminUser) => {
    if (!form) return { error: "invalid_request" };
    const assetType = String(form.get("assetType") ?? "");
    const file = form.get("file");
    const rules = ALLOWED[assetType];
    if (!rules || !(file instanceof File)) return { error: "invalid_request" };
    if (!rules.mimes.includes(file.type)) {
      return { error: "invalid_mime", allowed: rules.mimes };
    }
    if (file.size > rules.maxBytes) {
      return { error: "file_too_large", maxBytes: rules.maxBytes };
    }

    const game = await getGame();
    if (!game) return { error: "no_game" };
    const db = supabaseAdmin();

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${game.id}/${assetType}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from("media")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) return { error: "upload_failed", details: uploadError.message };

    // Reemplaza el asset previo del mismo tipo (unique game_id+asset_type).
    const { data: previous } = await db
      .from("media_assets")
      .select("*")
      .eq("game_id", game.id)
      .eq("asset_type", assetType)
      .maybeSingle();
    if (previous) {
      await db.storage.from("media").remove([previous.storage_path]);
      await db.from("media_assets").delete().eq("id", previous.id);
    }

    const { data: asset, error: insertError } = await db
      .from("media_assets")
      .insert({
        game_id: game.id,
        asset_type: assetType,
        storage_path: path,
        mime_type: file.type,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    await logEvent({
      gameId: game.id,
      adminUserId: adminUser,
      eventType: "media_uploaded",
      payload: { assetType, mime: file.type, bytes: file.size },
    });
    await notifyAdmin();
    return { ok: true, asset };
  });
}
