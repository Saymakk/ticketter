import { NextResponse } from "next/server";

export function jsonError(error: unknown, fallback = "Ошибка сервера") {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Нужна авторизация" }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("P1000") ||
    message.includes("Authentication failed against database") ||
    message.includes("ENOTFOUND") ||
    message.includes("tenant/user")
  ) {
    return NextResponse.json(
      {
        error:
          "Нет связи с базой Supabase. Проверьте HEALTHY_LIFE_DATABASE_URL/HEALTHY_LIFE_DIRECT_URL в .env (Settings → Database → Connection string → Direct, порт 5432) и что проект не на паузе.",
      },
      { status: 503 },
    );
  }

  if (
    message.includes("userId") ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("P2022")
  ) {
    return NextResponse.json(
      {
        error:
          "Схема БД Healthy Life устарела. Выполните: npm run healthy-life:db:push",
      },
      { status: 500 },
    );
  }

  if (message.includes("P2002") || message.includes("Unique constraint")) {
    return NextResponse.json(
      { error: "Конфликт данных профиля, обновите страницу." },
      { status: 409 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
