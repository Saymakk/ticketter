import { randomUUID } from "crypto";
import sharp from "sharp";
import { getMealPhotosBucket, getSupabaseAdmin } from "@/lib/healthy-life/supabase-admin";

const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 80;

/**
 * Normalize any meal photo to WebP (EXIF-rotated, downscaled) before Storage upload.
 * Returns the public URL plus the WebP bytes used for AI analysis.
 */
export async function saveMealPhoto(
  file: File,
): Promise<{ photoPath: string; buffer: Buffer; mimeType: string }> {
  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const mimeType = "image/webp";
  const objectPath = `meals/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.webp`;

  const supabase = getSupabaseAdmin();
  const bucket = getMealPhotosBucket();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, webp, {
    contentType: mimeType,
    upsert: false,
    cacheControl: "31536000",
  });

  if (error) {
    throw new Error(`Не удалось загрузить фото в Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  return {
    photoPath: data.publicUrl,
    buffer: webp,
    mimeType,
  };
}
