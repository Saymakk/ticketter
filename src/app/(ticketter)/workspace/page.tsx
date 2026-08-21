import type { Metadata } from "next";
import { listVisibleProjects, toPublicCard } from "@/lib/workspace/projects";
import { defaultPageSettings, getPageSettings } from "@/lib/workspace/page-settings";
import WorkspacePortalShell from "@/components/workspace/portal-shell";
import WorkspaceProjectGrid from "@/components/workspace/project-grid";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getPageSettings();
    return {
      title: settings.title,
      description: settings.subtitle,
    };
  } catch {
    return {
      title: "Workspace",
      description: "Каталог проектов myworkspace.su",
    };
  }
}

export default async function WorkspacePortalPage() {
  let projects: ReturnType<typeof toPublicCard>[] = [];
  let settings = defaultPageSettings();
  let loadError = "";

  try {
    projects = (await listVisibleProjects()).map(toPublicCard);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Не удалось загрузить проекты";
  }

  try {
    settings = await getPageSettings();
  } catch {
    settings = defaultPageSettings();
  }

  return (
    <WorkspacePortalShell>
      <header className="mb-10 max-w-2xl sm:mb-14">
        {settings.kicker ? (
          <p className="mb-3 text-sm font-medium tracking-[0.18em] text-[var(--ws-accent)] uppercase">
            {settings.kicker}
          </p>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--ws-fg)] sm:text-5xl">
          {settings.title}
        </h1>
        {settings.subtitle ? (
          <p className="mt-3 text-base leading-relaxed text-[var(--ws-muted)] sm:text-lg">
            {settings.subtitle}
          </p>
        ) : null}
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-[var(--ws-fg)]">
          {loadError}
        </div>
      ) : (
        <WorkspaceProjectGrid
          projects={projects}
          columns={settings.columns}
          emptyLabel="Проекты скоро появятся"
        />
      )}

      {settings.footer ? (
        <footer className="mt-auto pt-14 text-center text-xs text-[var(--ws-muted)]">
          {settings.footer}
        </footer>
      ) : null}
    </WorkspacePortalShell>
  );
}
