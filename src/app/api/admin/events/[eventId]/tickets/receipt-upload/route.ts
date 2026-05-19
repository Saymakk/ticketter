import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureTicketMutationAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

const BUCKET = "ticket-receipts";
const MAX_SIZE = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function normalizeExt(type: string, name: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  return "jpg";
}

function isAllowedReceipt(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|gif|pdf)$/i.test(lower);
}

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureTicketMutationAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const form = await request.formData();
  const raw = form.get("receipt");
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: "Файл чека не передан" }, { status: 400 });
  }

  if (!isAllowedReceipt(raw)) {
    return NextResponse.json(
      { error: "Чек должен быть изображением (JPG, PNG, WebP, GIF) или PDF" },
      { status: 400 }
    );
  }
  if (raw.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальный размер чека — 8MB" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const ext = normalizeExt(raw.type, raw.name);
  const contentType =
    raw.type === "application/pdf"
      ? "application/pdf"
      : raw.type.startsWith("image/")
        ? raw.type
        : ext === "pdf"
          ? "application/pdf"
          : "image/jpeg";

  const path = `${eventId}/${Date.now()}-${randomUUID()}.${ext}`;
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
