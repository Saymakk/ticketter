import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/api-guards";
import {
  getHealthyLifeUserDetail,
  isHealthyLifeAdminConfigured,
} from "@/lib/healthy-life/admin-users";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const check = await requireSuperAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  if (!isHealthyLifeAdminConfigured()) {
    return NextResponse.json(
      { error: "Healthy Life не настроен (проверьте переменные окружения)" },
      { status: 503 }
    );
  }

  const { userId } = await context.params;

  try {
    const detail = await getHealthyLifeUserDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить пользователя";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
