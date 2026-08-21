import { blockSpanClass, gridClass, type WorkspaceGridColumns } from "@/lib/workspace/layout";
import type { WorkspaceProjectCard } from "@/lib/workspace/types";
import WorkspaceProjectCardView from "./project-card";

type Props = {
  projects: WorkspaceProjectCard[];
  columns?: WorkspaceGridColumns;
  emptyLabel?: string;
};

export default function WorkspaceProjectGrid({
  projects,
  columns = 3,
  emptyLabel = "Пока нет проектов",
}: Props) {
  if (!projects.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--ws-card-border)] bg-[var(--ws-card)]/50 px-6 py-16 text-center">
        <p className="text-sm text-[var(--ws-muted)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className={gridClass(columns)}>
      {projects.map((project) => (
        <li key={project.id} className={blockSpanClass(project.display_size)}>
          <WorkspaceProjectCardView project={project} />
        </li>
      ))}
    </ul>
  );
}
