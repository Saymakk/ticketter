import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { WORKOUT_TYPES, WORKOUT_UNITS } from "@/lib/healthy-life/workouts";
import { jsonError } from "@/lib/healthy-life/api-error";

const typeIds = new Set(WORKOUT_TYPES.map((t) => t.id));
const unitIds = new Set(WORKOUT_UNITS.map((u) => u.id));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limitRaw = Number(searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;
    const profile = await getOrCreateProfile();

    const where: {
      profileId: string;
      date?: string | { gte?: string; lte?: string };
    } = { profileId: profile.id };

    if (date) {
      where.date = date;
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const workouts = await prisma.workout.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json({ workouts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await getOrCreateProfile();

    const type = String(body.type || "");
    const unit = String(body.unit || "minutes");
    const quantity = Number(body.quantity);

    if (!typeIds.has(type as never)) {
      return NextResponse.json({ error: "Неизвестный тип тренировки" }, { status: 400 });
    }
    if (!unitIds.has(unit as never)) {
      return NextResponse.json({ error: "Неизвестная единица" }, { status: 400 });
    }
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: "Укажите количество больше 0" }, { status: 400 });
    }

    const workout = await prisma.workout.create({
      data: {
        profileId: profile.id,
        date: body.date || todayKey(),
        type,
        unit,
        quantity,
        name: body.name?.trim() || null,
        note: body.note?.trim() || null,
        caloriesBurned:
          body.caloriesBurned === "" || body.caloriesBurned == null
            ? null
            : Number(body.caloriesBurned),
      },
    });

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    await getOrCreateProfile();
    await prisma.workout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
