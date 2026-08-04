import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import { deleteProject, updateProject } from "@/lib/workspace/projects";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      thumbnail_url?: string | null;
      description?: string | null;
      sort_order?: number;
      is_visible?: boolean;
      metadata?: Record<string, unknown>;
    };

    const project = await updateProject(id, body);
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка обновления";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка удаления";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
