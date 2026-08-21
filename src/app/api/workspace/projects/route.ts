import { NextResponse } from "next/server";
import { listVisibleProjects, toPublicCard } from "@/lib/workspace/projects";
import { defaultPageSettings, getPageSettings } from "@/lib/workspace/page-settings";

/** Public catalog for the Workspace portal */
export async function GET() {
  try {
    const [projects, settings] = await Promise.all([
      listVisibleProjects(),
      getPageSettings().catch(() => defaultPageSettings()),
    ]);
    return NextResponse.json({
      settings: {
        kicker: settings.kicker,
        title: settings.title,
        subtitle: settings.subtitle,
        footer: settings.footer,
        columns: settings.columns,
      },
      projects: projects.map(toPublicCard),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
