import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { todayKey } from "@/lib/healthy-life/dates";
import { jsonError } from "@/lib/healthy-life/api-error";
import { isWithinEditWindow } from "@/lib/healthy-life/edit-window";
import {
  buildDayCompliance,
  isPlanScheduledOnDate,
  nowTimeKey,
  parsePlanTimes,
  resolveMedicationPhoto,
} from "@/lib/healthy-life/medications";
import { getZonedNow } from "@/lib/healthy-life/reminders";
import { saveAiCorrection } from "@/lib/healthy-life/ai-corrections";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const profile = await getOrCreateProfile();
    const zoned = getZonedNow(profile.timezone || "UTC");
    const day = date || zoned.dateKey;

    const [intakesRaw, allPlans] = await Promise.all([
      prisma.medicationIntake.findMany({
        where: { profileId: profile.id, date: day },
        orderBy: [{ takenTime: "asc" }, { createdAt: "asc" }],
      }),
      prisma.medicationPlan.findMany({
        where: { profileId: profile.id },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
    ]);

    const plans = allPlans.filter((p) => p.active);
    const intakes = intakesRaw.map((i) => ({
      ...i,
      photoPath: resolveMedicationPhoto(i, allPlans),
    }));

    const compliance = buildDayCompliance({
      plans,
      intakes,
      date: day,
      today: zoned.dateKey,
      nowTime: zoned.timeKey,
    });

    return NextResponse.json({ date: day, intakes, plans, compliance });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await getOrCreateProfile();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Укажите название лекарства" }, { status: 400 });
    }

    let scheduledTime: string | null = body.scheduledTime ? String(body.scheduledTime) : null;
    let planId: string | null = body.planId ? String(body.planId) : null;
    let photoPath: string | null = body.photoPath ?? null;

    const intakeDate = body.date || todayKey();

    if (planId) {
      const plan = await prisma.medicationPlan.findFirst({
        where: { id: planId, profileId: profile.id },
      });
      if (!plan) {
        return NextResponse.json({ error: "График не найден" }, { status: 404 });
      }
      if (!isPlanScheduledOnDate(plan, intakeDate)) {
        return NextResponse.json(
          { error: "Этот график не действует в выбранный день" },
          { status: 400 },
        );
      }
      if (scheduledTime && !parsePlanTimes(plan.timesJson).includes(scheduledTime)) {
        scheduledTime = null;
      }
      if (!photoPath && plan.photoPath) {
        photoPath = plan.photoPath;
      }
    }

    const intake = await prisma.medicationIntake.create({
      data: {
        profileId: profile.id,
        planId,
        date: intakeDate,
        name,
        dosage: body.dosage?.trim() || null,
        reason: body.reason?.trim() || null,
        photoPath,
        scheduledTime,
        takenTime: body.takenTime || nowTimeKey(),
      },
    });

    const aiDetectedName =
      typeof body.aiDetectedName === "string" ? body.aiDetectedName.trim() : "";
    if (aiDetectedName && aiDetectedName.toLowerCase() !== name.toLowerCase()) {
      await saveAiCorrection({
        profileId: profile.id,
        kind: "medication_analysis",
        ai: { name: aiDetectedName },
        user: { name },
        sourceId: intake.id,
      });
    }

    return NextResponse.json(intake, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const profile = await getOrCreateProfile();
    const existing = await prisma.medicationIntake.findFirst({
      where: { id: body.id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    if (!isWithinEditWindow(existing.createdAt)) {
      return NextResponse.json(
        { error: "Редактировать можно только в течение часа после внесения" },
        { status: 403 },
      );
    }

    const intake = await prisma.medicationIntake.update({
      where: { id: existing.id },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        dosage: body.dosage !== undefined ? body.dosage?.trim() || null : undefined,
        reason: body.reason !== undefined ? body.reason?.trim() || null : undefined,
        photoPath: body.photoPath !== undefined ? body.photoPath : undefined,
        takenTime: body.takenTime != null ? String(body.takenTime) : undefined,
        scheduledTime: body.scheduledTime !== undefined ? body.scheduledTime || null : undefined,
      },
    });

    if (
      body.name != null &&
      existing.photoPath &&
      String(body.name).trim().toLowerCase() !== existing.name.toLowerCase()
    ) {
      await saveAiCorrection({
        profileId: profile.id,
        kind: "medication_analysis",
        ai: { name: existing.name },
        user: { name: intake.name },
        sourceId: intake.id,
      });
    }

    return NextResponse.json(intake);
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
    const profile = await getOrCreateProfile();
    const existing = await prisma.medicationIntake.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    if (!isWithinEditWindow(existing.createdAt)) {
      return NextResponse.json(
        { error: "Удалить можно только в течение часа после внесения" },
        { status: 403 },
      );
    }
    await prisma.medicationIntake.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
