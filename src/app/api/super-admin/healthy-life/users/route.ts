import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/api-guards";
import {
  isHealthyLifeAdminConfigured,
  listHealthyLifeUsers,
} from "@/lib/healthy-life/admin-users";

export async function GET() {
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

  try {
    const users = await listHealthyLifeUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить пользователей";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
