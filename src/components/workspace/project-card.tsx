import type { ReactNode } from "react";
import {
  formatFileSize,
  type WorkspaceAttachment,
} from "@/lib/workspace/layout";
import type { WorkspaceProjectCard } from "@/lib/workspace/types";

type Props = {
  project: WorkspaceProjectCard;
};

const chrome =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--ws-card-border)] bg-[var(--ws-card)] shadow-[var(--ws-shadow)] transition duration-300 ease-out hover:-translate-y-1 hover:border-[var(--ws-accent-soft)] hover:shadow-[var(--ws-shadow-hover)]";

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function Thumb({
  project,
  className,
}: {
  project: WorkspaceProjectCard;
  className: string;
}) {
  if (project.thumbnail_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={project.thumbnail_url}
        alt=""
        className={`h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04] ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ws-accent-soft)] text-xl font-semibold tracking-tight text-[var(--ws-accent)] transition duration-300 group-hover:scale-105 sm:h-16 sm:w-16 sm:text-2xl">
        {project.kind === "file" ? "↓" : initialOf(project.name)}
      </span>
    </div>
  );
}

function ActionMark({ isFile }: { isFile: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 shrink-0 text-[var(--ws-muted)] transition duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--ws-accent)]"
    >
      {isFile ? "↓" : "↗"}
    </span>
  );
}

function TitleBlock({
  project,
  large,
}: {
  project: WorkspaceProjectCard;
  large?: boolean;
}) {
  const isFile = project.kind === "file";
  const meta = isFile
    ? [project.file_name, formatFileSize(project.file_size)].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h2
          className={`font-semibold tracking-tight text-[var(--ws-fg)] ${
            large ? "text-lg sm:text-2xl" : "text-base sm:text-lg"
          }`}
        >
          {project.name}
        </h2>
        <ActionMark isFile={isFile} />
      </div>
      {meta ? (
        <p className="mt-0.5 truncate text-xs text-[var(--ws-muted)]">{meta}</p>
      ) : null}
    </div>
  );
}

function Description({
  project,
  lines = 2,
}: {
  project: WorkspaceProjectCard;
  lines?: 2 | 3;
}) {
  if (!project.description) return null;
  return (
    <p
      className={`text-sm leading-relaxed text-[var(--ws-muted)] ${
        lines === 3 ? "line-clamp-3" : "line-clamp-2"
      }`}
    >
      {project.description}
    </p>
  );
}

function Attachments({ items }: { items: WorkspaceAttachment[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-auto space-y-1.5 border-t border-[var(--ws-card-border)] px-4 py-3 sm:px-5">
      {items.map((file) => (
        <li key={`${file.url}-${file.name}`}>
          <a
            href={file.url}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-sm text-[var(--ws-accent)] transition hover:bg-[var(--ws-accent-soft)]"
          >
            <span className="min-w-0 truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-[var(--ws-muted)]">
              {formatFileSize(file.size) || "↓"}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function MainLink({
  project,
  className,
  children,
}: {
  project: WorkspaceProjectCard;
  className?: string;
  children: ReactNode;
}) {
  const isFile = project.kind === "file";
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      download={isFile ? project.file_name || true : undefined}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-bg)] ${className ?? ""}`}
    >
      {children}
    </a>
  );
}

function thumbAspect(size: WorkspaceProjectCard["display_size"]) {
  if (size === "s") return "aspect-[16/9]";
  if (size === "xl") return "aspect-[21/9]";
  return "aspect-[16/10]";
}

function compactThumbSize(size: WorkspaceProjectCard["display_size"]) {
  if (size === "s") return "h-12 w-12";
  if (size === "l") return "h-20 w-24";
  if (size === "xl") return "h-24 w-32";
  return "h-16 w-16";
}

export default function WorkspaceProjectCardView({ project }: Props) {
  const variant = project.display_variant;
  const size = project.display_size;
  const pad = size === "s" ? "p-3 sm:p-3.5" : "p-4 sm:p-5";

  if (variant === "compact") {
    return (
      <article className={chrome}>
        <MainLink project={project} className={`flex flex-1 items-center gap-3 ${pad}`}>
          <div
            className={`relative shrink-0 overflow-hidden rounded-xl bg-[var(--ws-thumb-bg)] ${compactThumbSize(size)}`}
          >
            <Thumb project={project} className="" />
          </div>
          <div className="min-w-0 flex-1">
            <TitleBlock project={project} />
            <Description project={project} />
          </div>
        </MainLink>
        <Attachments items={project.attachments} />
      </article>
    );
  }

  if (variant === "wide") {
    return (
      <article className={chrome}>
        <MainLink project={project} className="relative flex min-h-[9rem] flex-1 flex-col sm:min-h-[11rem]">
          <div className="absolute inset-0 bg-[var(--ws-thumb-bg)]">
            {project.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.thumbnail_url}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[var(--ws-accent-soft)] to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--ws-card)] via-[var(--ws-card)]/85 to-[var(--ws-card)]/25" />
          </div>
          <div className={`relative z-10 mt-auto max-w-xl ${pad}`}>
            <TitleBlock project={project} large={size === "l" || size === "xl"} />
            <div className="mt-1.5">
              <Description project={project} lines={3} />
            </div>
          </div>
        </MainLink>
        <Attachments items={project.attachments} />
      </article>
    );
  }

  if (variant === "tile") {
    return (
      <article className={chrome}>
        <MainLink project={project} className="flex flex-1 flex-col">
          <div className="relative aspect-square overflow-hidden bg-[var(--ws-thumb-bg)]">
            <Thumb project={project} className="" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--ws-card)] via-[var(--ws-card)]/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <TitleBlock project={project} />
            </div>
          </div>
          {project.description ? (
            <div className={`${pad} pt-3`}>
              <Description project={project} />
            </div>
          ) : null}
        </MainLink>
        <Attachments items={project.attachments} />
      </article>
    );
  }

  return (
    <article className={chrome}>
      <MainLink project={project} className="flex flex-1 flex-col">
        <div className={`relative overflow-hidden bg-[var(--ws-thumb-bg)] ${thumbAspect(size)}`}>
          <Thumb project={project} className="" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--ws-card)]/80 via-transparent to-transparent opacity-60" />
        </div>
        <div className={`flex flex-1 flex-col gap-1.5 ${pad}`}>
          <TitleBlock project={project} large={size === "xl"} />
          <Description project={project} />
        </div>
      </MainLink>
      <Attachments items={project.attachments} />
    </article>
  );
}
