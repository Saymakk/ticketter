export const WORKSPACE_KINDS = ["site", "file"] as const;
export type WorkspaceBlockKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_SIZES = ["s", "m", "l", "xl"] as const;
export type WorkspaceDisplaySize = (typeof WORKSPACE_SIZES)[number];

export const WORKSPACE_VARIANTS = ["card", "compact", "wide", "tile"] as const;
export type WorkspaceDisplayVariant = (typeof WORKSPACE_VARIANTS)[number];

export const WORKSPACE_COLUMNS = [2, 3, 4] as const;
export type WorkspaceGridColumns = (typeof WORKSPACE_COLUMNS)[number];

export type WorkspaceAttachment = {
  url: string;
  name: string;
  size: number | null;
  mime: string | null;
};

export function isWorkspaceKind(value: unknown): value is WorkspaceBlockKind {
  return value === "site" || value === "file";
}

export function isWorkspaceSize(value: unknown): value is WorkspaceDisplaySize {
  return value === "s" || value === "m" || value === "l" || value === "xl";
}

export function isWorkspaceVariant(value: unknown): value is WorkspaceDisplayVariant {
  return (
    value === "card" ||
    value === "compact" ||
    value === "wide" ||
    value === "tile"
  );
}

export function isWorkspaceColumns(value: unknown): value is WorkspaceGridColumns {
  return value === 2 || value === 3 || value === 4;
}

export function parseKind(value: unknown): WorkspaceBlockKind {
  return isWorkspaceKind(value) ? value : "site";
}

export function parseSize(value: unknown): WorkspaceDisplaySize {
  return isWorkspaceSize(value) ? value : "m";
}

export function parseVariant(value: unknown): WorkspaceDisplayVariant {
  return isWorkspaceVariant(value) ? value : "card";
}

export function parseColumns(value: unknown): WorkspaceGridColumns {
  const n = typeof value === "string" ? Number(value) : value;
  return isWorkspaceColumns(n) ? n : 3;
}

export function parseAttachments(raw: unknown): WorkspaceAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkspaceAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!url || !name) continue;
    const size =
      typeof rec.size === "number" && Number.isFinite(rec.size) && rec.size >= 0
        ? Math.round(rec.size)
        : null;
    const mime = typeof rec.mime === "string" && rec.mime.trim() ? rec.mime.trim() : null;
    out.push({ url, name, size, mime });
    if (out.length >= 20) break;
  }
  return out;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

export function blockSpanClass(size: WorkspaceDisplaySize): string {
  if (size === "l") return "col-span-1 sm:col-span-2";
  if (size === "xl") return "col-span-1 sm:col-span-2 lg:col-span-full";
  return "col-span-1";
}

export function gridClass(columns: WorkspaceGridColumns): string {
  if (columns === 2) return "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5";
  if (columns === 4) {
    return "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4";
  }
  return "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3";
}

export function clipText(value: string, max: number): string {
  return value.trim().slice(0, max);
}
