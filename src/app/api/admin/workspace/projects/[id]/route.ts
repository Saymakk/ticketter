import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import {
  parseAttachments,
  parseKind,
  parseSize,
  parseVariant,
} from "@/lib/workspace/layout";
import { deleteProject, updateProject } from "@/lib/workspace/projects";
import type { WorkspaceProjectInput } from "@/lib/workspace/types";

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
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Partial<WorkspaceProjectInput> = {};

    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.url === "string") patch.url = body.url;
    if (body.thumbnail_url === null || typeof body.thumbnail_url === "string") {
      patch.thumbnail_url = body.thumbnail_url;
    }
    if (body.description === null || typeof body.description === "string") {
      patch.description = body.description;
    }
    if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;
    if (typeof body.is_visible === "boolean") patch.is_visible = body.is_visible;
    if (body.kind !== undefined) patch.kind = parseKind(body.kind);
    if (body.display_size !== undefined) patch.display_size = parseSize(body.display_size);
    if (body.display_variant !== undefined) {
      patch.display_variant = parseVariant(body.display_variant);
    }
    if (body.file_name === null || typeof body.file_name === "string") {
      patch.file_name = body.file_name;
    }
    if (body.file_size === null || typeof body.file_size === "number") {
      patch.file_size = body.file_size;
    }
    if (body.file_mime === null || typeof body.file_mime === "string") {
      patch.file_mime = body.file_mime;
    }
    if (body.attachments !== undefined) {
      patch.attachments = parseAttachments(body.attachments);
    }
    if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
      patch.metadata = body.metadata as Record<string, unknown>;
    }

    const project = await updateProject(id, patch);
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
