import { randomUUID } from "crypto";
import { getMealPhotosBucket, getSupabaseAdmin } from "@/lib/healthy-life/supabase-admin";

export async function saveMealPhoto(
  file: File,
): Promise<{ photoPath: string; buffer: Buffer; mimeType: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const ext = guessExt(mimeType, file.name);
  const objectPath = `meals/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const bucket = getMealPhotosBucket();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Не удалось загрузить фото в Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  return {
    photoPath: data.publicUrl,
    buffer: bytes,
    mimeType,
  };
}

function guessExt(mime: string, name: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}
