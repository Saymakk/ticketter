import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isLocale, type Locale } from "@/lib/i18n/types";

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.ctx.supabase
    .from("profiles")
    .select("locale")
    .eq("id", auth.ctx.user.id)
    .single();

  if (error || data == null) {
    return NextResponse.json({ locale: "ru" satisfies Locale });
  }

  const loc = data.locale;
  const locale: Locale = typeof loc === "string" && isLocale(loc) ? loc : "ru";
  return NextResponse.json({ locale });
}

export async function PATCH(req: Request) {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("locale" in body)) {
    return NextResponse.json({ error: "locale required" }, { status: 400 });
  }

  const raw = (body as { locale: unknown }).locale;
  if (typeof raw !== "string" || !isLocale(raw)) {
    return NextResponse.json({ error: "locale must be ru, kk, or en" }, { status: 400 });
  }

  const { error } = await auth.ctx.supabase
    .from("profiles")
    .update({ locale: raw })
    .eq("id", auth.ctx.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locale: raw });
}
