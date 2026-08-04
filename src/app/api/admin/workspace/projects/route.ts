import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import { createProject, listAllProjects } from "@/lib/workspace/projects";

export async function GET() {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const projects = await listAllProjects();
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      thumbnail_url?: string | null;
      description?: string | null;
      sort_order?: number;
      is_visible?: boolean;
    };

    if (!body.name?.trim() || !body.url?.trim()) {
      return NextResponse.json(
        { error: "Название и URL обязательны" },
        { status: 400 }
      );
    }

    const project = await createProject(
      {
        name: body.name,
        url: body.url,
        thumbnail_url: body.thumbnail_url,
        description: body.description,
        sort_order: body.sort_order,
        is_visible: body.is_visible,
      },
      auth.ctx.user.id
    );

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка создания";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
