import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";

const THUMB_BUCKET = "workspace-thumbnails";
const FILE_BUCKET = "workspace-files";
const MAX_THUMB = 5 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const FILE_EXT = new Set([
  "pdf",
  "zip",
  "rar",
  "7z",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "md",
  "json",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "mp3",
  "mp4",
  "webm",
]);

function extFromName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "file";
  return base.slice(0, 180);
}

function normalizeImageExt(type: string, name: string): string {
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
  if (IMAGE_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function isAllowedFile(file: File): boolean {
  const ext = extFromName(file.name);
  if (ext && FILE_EXT.has(ext)) return true;
  if (IMAGE_TYPES.has(file.type)) return true;
  if (file.type === "application/pdf") return true;
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed") {
    return true;
  }
  return false;
}

function contentTypeForFile(file: File, ext: string): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  if (ext === "pdf") return "application/pdf";
  if (ext === "zip") return "application/zip";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "txt" || ext === "md" || ext === "csv") return "text/plain";
  if (ext === "json") return "application/json";
  return "application/octet-stream";
}

/** Thumbnail or downloadable file upload via Supabase Storage. */
export async function POST(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const form = await request.formData();
  const purpose = String(form.get("purpose") || "thumbnail");
  const raw = form.get("file") ?? form.get("thumbnail");
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const asFile = purpose === "file";
  if (asFile) {
    if (!isAllowedFile(raw)) {
      return NextResponse.json(
        { error: "Этот тип файла нельзя прикрепить" },
        { status: 400 }
      );
    }
    if (raw.size > MAX_FILE) {
      return NextResponse.json({ error: "Максимальный размер — 25MB" }, { status: 400 });
    }
  } else {
    if (!isAllowedImage(raw)) {
      return NextResponse.json(
        { error: "Нужно изображение: JPG, PNG, WebP или GIF" },
        { status: 400 }
      );
    }
    if (raw.size > MAX_THUMB) {
      return NextResponse.json({ error: "Максимальный размер — 5MB" }, { status: 400 });
    }
  }

  const admin = createAdminSupabaseClient();
  const bucket = asFile ? FILE_BUCKET : THUMB_BUCKET;
  await admin.storage.createBucket(bucket, { public: true }).catch(() => undefined);

  const ext = asFile
    ? extFromName(raw.name) || "bin"
    : normalizeImageExt(raw.type, raw.name);
  const contentType = asFile
    ? contentTypeForFile(raw, ext)
    : raw.type.startsWith("image/")
      ? raw.type
      : `image/${ext === "jpg" ? "jpeg" : ext}`;
  const folder = asFile ? "files" : "";
  const path = `${folder ? `${folder}/` : ""}${Date.now()}-${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await raw.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    name: sanitizeFileName(raw.name),
    size: raw.size,
    mime: contentType,
  });
}
