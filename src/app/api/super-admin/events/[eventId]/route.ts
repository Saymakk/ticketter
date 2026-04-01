import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
    title: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    eventDate: z.string().min(10).optional(),
    isActive: z.boolean().optional(),
});

async function ensureSuperAdmin() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, status: 401, error: "Не авторизован" };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "super_admin") return { ok: false as const, status: 403, error: "Доступ запрещен" };

    return { ok: true as const };
}

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: Request, { params }: Params) {
    const check = await ensureSuperAdmin();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

    const p = parsed.data;
    const payload: Record<string, unknown> = {};
    if (p.title !== undefined) payload.title = p.title;
    if (p.city !== undefined) payload.city = p.city;
    if (p.eventDate !== undefined) payload.event_date = p.eventDate;
    if (p.isActive !== undefined) payload.is_active = p.isActive;

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("events").update(payload).eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
    const check = await ensureSuperAdmin();
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { eventId } = await params;
    const admin = createAdminSupabaseClient();

    // Сработает clean delete, если в FK стоит ON DELETE CASCADE
    const { error } = await admin.from("events").delete().eq("id", eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}