import { randomUUID } from "crypto";
import sharp from "sharp";
import { getMealPhotosBucket, getSupabaseAdmin } from "@/lib/healthy-life/supabase-admin";

const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 80;

export type SavedPhoto = { photoPath: string; buffer: Buffer; mimeType: string };

/**
 * Normalize any photo to WebP (EXIF-rotated, downscaled) before Storage upload.
 * `folder` separates meals vs medications in the same bucket.
 */
export async function savePhoto(file: File, folder: "meals" | "medications"): Promise<SavedPhoto> {
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
  const objectPath = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.webp`;

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

/** @deprecated use savePhoto(file, "meals") */
export async function saveMealPhoto(file: File): Promise<SavedPhoto> {
  return savePhoto(file, "meals");
}
