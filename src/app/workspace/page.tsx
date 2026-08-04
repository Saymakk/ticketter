import type { Metadata } from "next";
import { listVisibleProjects } from "@/lib/workspace/projects";
import WorkspacePortalShell from "@/components/workspace/portal-shell";
import WorkspaceProjectGrid from "@/components/workspace/project-grid";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Каталог проектов myworkspace.su",
};

export const dynamic = "force-dynamic";

export default async function WorkspacePortalPage() {
  let projects: Awaited<ReturnType<typeof listVisibleProjects>> = [];
  let loadError = "";

  try {
    projects = await listVisibleProjects();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Не удалось загрузить проекты";
  }

  return (
    <WorkspacePortalShell>
      <header className="mb-10 max-w-2xl sm:mb-14">
        <p className="mb-3 text-sm font-medium tracking-[0.18em] text-[var(--ws-accent)] uppercase">
          myworkspace
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--ws-fg)] sm:text-5xl">
          Workspace
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--ws-muted)] sm:text-lg">
          Все проекты в одном месте. Откройте карточку — сайт откроется в новой вкладке.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-[var(--ws-fg)]">
          {loadError}
        </div>
      ) : (
        <WorkspaceProjectGrid
          projects={projects}
          emptyLabel="Проекты скоро появятся"
        />
      )}

      <footer className="mt-auto pt-14 text-center text-xs text-[var(--ws-muted)]">
        myworkspace.su
      </footer>
    </WorkspacePortalShell>
  );
}
