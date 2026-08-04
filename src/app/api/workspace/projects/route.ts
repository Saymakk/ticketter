import { NextResponse } from "next/server";
import { listVisibleProjects } from "@/lib/workspace/projects";

/** Public catalog for the Workspace portal */
export async function GET() {
  try {
    const projects = await listVisibleProjects();
    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        thumbnail_url: p.thumbnail_url,
        description: p.description,
        sort_order: p.sort_order,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
