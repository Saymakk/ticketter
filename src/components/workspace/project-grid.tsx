import type { WorkspaceProjectCard } from "@/lib/workspace/types";
import WorkspaceProjectCardView from "./project-card";

type Props = {
  projects: WorkspaceProjectCard[];
  emptyLabel?: string;
};

export default function WorkspaceProjectGrid({
  projects,
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
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <WorkspaceProjectCardView project={project} />
        </li>
      ))}
    </ul>
  );
}
