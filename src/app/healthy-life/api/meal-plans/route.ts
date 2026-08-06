import { NextResponse } from "next/server";
import { getOrCreateProfile, prisma } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";
import { todayKey } from "@/lib/healthy-life/dates";
import {
  normalizeRecurrence,
  serializePlanTimes,
  serializeWeekdays,
} from "@/lib/healthy-life/medications";

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);

function parseAnchorDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeMealType(raw: unknown): string {
  const s = String(raw || "snack").trim().toLowerCase();
  return MEAL_TYPES.has(s) ? s : "snack";
}

function planRecurrenceData(body: Record<string, unknown>) {
  const recurrence = normalizeRecurrence(body.recurrence);
  let weekdays: Array<string | number> = [];
  if (Array.isArray(body.weekdays)) {
    weekdays = body.weekdays as Array<string | number>;
  } else if (typeof body.weekdaysJson === "string") {
    try {
      const parsed = JSON.parse(body.weekdaysJson || "[]") as unknown;
      weekdays = Array.isArray(parsed) ? (parsed as Array<string | number>) : [];
    } catch {
      weekdays = [];
    }
  }
  const intervalDays = Math.max(1, Math.floor(Number(body.intervalDays) || 1));
  const anchorDate =
    parseAnchorDate(body.anchorDate) ??
    (recurrence === "interval" ? todayKey() : null);

  if (recurrence === "weekly" && serializeWeekdays(weekdays) === "[]") {
    return { error: "Select at least one weekday" as const };
  }

  return {
    recurrence,
    weekdaysJson: recurrence === "weekly" ? serializeWeekdays(weekdays) : "[]",
    intervalDays: recurrence === "interval" ? intervalDays : 1,
    anchorDate: recurrence === "interval" || body.anchorDate != null ? anchorDate : null,
  };
}

export async function GET() {
  try {
    const profile = await getOrCreateProfile();
    const plans = await prisma.mealPlan.findMany({
      where: { profileId: profile.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ plans });
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
      return NextResponse.json({ error: "Укажите название приёма пищи" }, { status: 400 });
    }
    const times = Array.isArray(body.times) ? body.times.map(String) : [];
    if (times.length === 0) {
      return NextResponse.json({ error: "Добавьте хотя бы одно время" }, { status: 400 });
    }

    const recurrence = planRecurrenceData(body);
    if ("error" in recurrence) {
      return NextResponse.json({ error: recurrence.error }, { status: 400 });
    }

    const plan = await prisma.mealPlan.create({
      data: {
        profileId: profile.id,
        name,
        mealType: normalizeMealType(body.mealType),
        note: body.note?.trim() || null,
        timesJson: serializePlanTimes(times),
        recurrence: recurrence.recurrence,
        weekdaysJson: recurrence.weekdaysJson,
        intervalDays: recurrence.intervalDays,
        anchorDate: recurrence.anchorDate,
        active: body.active !== false,
      },
    });

    return NextResponse.json(plan, { status: 201 });
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
    const existing = await prisma.mealPlan.findFirst({
      where: { id: body.id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Расписание не найдено" }, { status: 404 });
    }

    const hasRecurrenceUpdate =
      body.recurrence != null ||
      body.weekdays != null ||
      body.weekdaysJson != null ||
      body.intervalDays != null ||
      body.anchorDate !== undefined;

    let recurrencePatch: ReturnType<typeof planRecurrenceData> | null = null;
    if (hasRecurrenceUpdate) {
      recurrencePatch = planRecurrenceData({
        recurrence: body.recurrence ?? existing.recurrence,
        weekdays:
          body.weekdays ??
          (body.weekdaysJson != null ? undefined : JSON.parse(existing.weekdaysJson || "[]")),
        weekdaysJson: body.weekdaysJson,
        intervalDays: body.intervalDays ?? existing.intervalDays,
        anchorDate: body.anchorDate !== undefined ? body.anchorDate : existing.anchorDate,
      });
      if ("error" in recurrencePatch) {
        return NextResponse.json({ error: recurrencePatch.error }, { status: 400 });
      }
    }

    const plan = await prisma.mealPlan.update({
      where: { id: existing.id },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        mealType: body.mealType != null ? normalizeMealType(body.mealType) : undefined,
        note: body.note !== undefined ? body.note?.trim() || null : undefined,
        timesJson: Array.isArray(body.times) ? serializePlanTimes(body.times.map(String)) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
        ...(recurrencePatch && !("error" in recurrencePatch)
          ? {
              recurrence: recurrencePatch.recurrence,
              weekdaysJson: recurrencePatch.weekdaysJson,
              intervalDays: recurrencePatch.intervalDays,
              anchorDate: recurrencePatch.anchorDate,
            }
          : {}),
      },
    });

    return NextResponse.json(plan);
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
    const existing = await prisma.mealPlan.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Расписание не найдено" }, { status: 404 });
    }
    await prisma.mealPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
