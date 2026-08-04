import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 30);
    const profile = await getOrCreateProfile();

    const entries = await prisma.weightEntry.findMany({
      where: { profileId: profile.id },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json({ profile, entries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await getOrCreateProfile();
    const date = body.date || todayKey();
    const weightKg = Number(body.weightKg);

    if (!weightKg || weightKg < 20 || weightKg > 400) {
      return NextResponse.json({ error: "Укажите корректный вес" }, { status: 400 });
    }

    const entry = await prisma.weightEntry.upsert({
      where: { profileId_date: { profileId: profile.id, date } },
      create: {
        profileId: profile.id,
        date,
        weightKg,
        note: body.note ?? null,
      },
      update: {
        weightKg,
        note: body.note ?? null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
