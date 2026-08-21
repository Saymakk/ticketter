import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import { parseColumns } from "@/lib/workspace/layout";
import { getPageSettings, updatePageSettings } from "@/lib/workspace/page-settings";

export async function GET() {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const settings = await getPageSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await updatePageSettings({
      kicker: typeof body.kicker === "string" ? body.kicker : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
      footer: typeof body.footer === "string" ? body.footer : undefined,
      columns: body.columns !== undefined ? parseColumns(body.columns) : undefined,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сохранения";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
