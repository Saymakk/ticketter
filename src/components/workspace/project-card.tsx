import type { WorkspaceProjectCard } from "@/lib/workspace/types";

type Props = {
  project: WorkspaceProjectCard;
};

export default function WorkspaceProjectCardView({ project }: Props) {
  const initial = project.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--ws-card-border)] bg-[var(--ws-card)] shadow-[var(--ws-shadow)] transition duration-300 ease-out hover:-translate-y-1 hover:border-[var(--ws-accent-soft)] hover:shadow-[var(--ws-shadow-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-bg)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--ws-thumb-bg)]">
        {project.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ws-accent-soft)] text-2xl font-semibold tracking-tight text-[var(--ws-accent)] transition duration-300 group-hover:scale-105">
              {initial}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--ws-card)]/80 via-transparent to-transparent opacity-60" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-[var(--ws-fg)] sm:text-lg">
            {project.name}
          </h2>
          <span
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--ws-muted)] transition duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--ws-accent)]"
          >
            ↗
          </span>
        </div>
        {project.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-[var(--ws-muted)]">
            {project.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}
