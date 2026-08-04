import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";

const BUCKET = "workspace-thumbnails";
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeExt(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  if (lower.endsWith(".gif")) return "gif";
  return "jpg";
}

function isAllowedImage(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

/** Thumbnail upload via Supabase Storage (same pattern as ticket receipts). */
export async function POST(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const form = await request.formData();
  const raw = form.get("thumbnail");
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!isAllowedImage(raw)) {
    return NextResponse.json(
      { error: "Нужно изображение: JPG, PNG, WebP или GIF" },
      { status: 400 }
    );
  }
  if (raw.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальный размер — 5MB" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const ext = normalizeExt(raw.type, raw.name);
  const contentType = raw.type.startsWith("image/") ? raw.type : `image/${ext === "jpg" ? "jpeg" : ext}`;
  const path = `${Date.now()}-${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await raw.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
