import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/workspace/access";
import { reorderProjects } from "@/lib/workspace/projects";

export async function POST(request: Request) {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds) || body.orderedIds.some((x) => typeof x !== "string")) {
      return NextResponse.json(
        { error: "orderedIds должен быть массивом строк" },
        { status: 400 }
      );
    }

    const projects = await reorderProjects(body.orderedIds);
    return NextResponse.json({ ok: true, projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сортировки";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
