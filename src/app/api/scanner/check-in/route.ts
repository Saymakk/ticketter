import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
    uuid: z.string().uuid(),
    eventId: z.string().uuid(),
});

export async function POST(request: Request) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { uuid, eventId } = parsed.data;

    const { data, error } = await supabase.rpc("check_in_ticket_scoped", {
        p_ticket_uuid: uuid,
        p_event_id: eventId,
        p_user_id: user.id,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = data?.[0];
    return NextResponse.json({
        success: !!row?.success,
        message: row?.message ?? "Неизвестный ответ",
    });
}