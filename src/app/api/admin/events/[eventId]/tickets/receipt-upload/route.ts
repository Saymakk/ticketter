import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureTicketMutationAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

const BUCKET = "ticket-receipts";
const MAX_SIZE = 8 * 1024 * 1024;

function normalizeExt(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureTicketMutationAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const form = await request.formData();
  const raw = form.get("receipt");
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: "Изображение чека не передано" }, { status: 400 });
  }

  if (!raw.type.startsWith("image/")) {
    return NextResponse.json({ error: "Чек должен быть изображением" }, { status: 400 });
  }
  if (raw.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальный размер чека — 8MB" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const ext = normalizeExt(raw.type);
  const path = `${eventId}/${Date.now()}-${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await raw.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: raw.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
