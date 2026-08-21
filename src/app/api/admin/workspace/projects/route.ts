import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import {
  parseAttachments,
  parseKind,
  parseSize,
  parseVariant,
} from "@/lib/workspace/layout";
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
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name : "";
    const url = typeof body.url === "string" ? body.url : "";

    if (!name.trim() || !url.trim()) {
      return NextResponse.json(
        { error: "Название и URL обязательны" },
        { status: 400 }
      );
    }

    const project = await createProject(
      {
        name,
        url,
        thumbnail_url: typeof body.thumbnail_url === "string" ? body.thumbnail_url : null,
        description: typeof body.description === "string" ? body.description : null,
        sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
        is_visible: typeof body.is_visible === "boolean" ? body.is_visible : undefined,
        kind: parseKind(body.kind),
        display_size: parseSize(body.display_size),
        display_variant: parseVariant(body.display_variant),
        file_name: typeof body.file_name === "string" ? body.file_name : null,
        file_size: typeof body.file_size === "number" ? body.file_size : null,
        file_mime: typeof body.file_mime === "string" ? body.file_mime : null,
        attachments: parseAttachments(body.attachments),
      },
      auth.ctx.user.id
    );

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка создания";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
