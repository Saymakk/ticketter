import type {
  WorkspaceAttachment,
  WorkspaceBlockKind,
  WorkspaceDisplaySize,
  WorkspaceDisplayVariant,
  WorkspaceGridColumns,
} from "./layout";

/** Workspace portal project / file block */
export type WorkspaceProject = {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
  kind: WorkspaceBlockKind;
  display_size: WorkspaceDisplaySize;
  display_variant: WorkspaceDisplayVariant;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  attachments: WorkspaceAttachment[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Public-facing card (no admin-only fields required by UI) */
export type WorkspaceProjectCard = Pick<
  WorkspaceProject,
  | "id"
  | "name"
  | "url"
  | "thumbnail_url"
  | "description"
  | "sort_order"
  | "kind"
  | "display_size"
  | "display_variant"
  | "file_name"
  | "file_size"
  | "file_mime"
  | "attachments"
>;

export type WorkspaceProjectInput = {
  name: string;
  url: string;
  thumbnail_url?: string | null;
  description?: string | null;
  sort_order?: number;
  is_visible?: boolean;
  kind?: WorkspaceBlockKind;
  display_size?: WorkspaceDisplaySize;
  display_variant?: WorkspaceDisplayVariant;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  attachments?: WorkspaceAttachment[];
  metadata?: Record<string, unknown>;
};

export type WorkspacePageSettings = {
  id: number;
  kicker: string;
  title: string;
  subtitle: string;
  footer: string;
  columns: WorkspaceGridColumns;
  updated_at: string;
};

export type WorkspacePageSettingsInput = {
  kicker?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  columns?: WorkspaceGridColumns;
};

export const WORKSPACE_PROJECT_SELECT =
  "id,name,url,thumbnail_url,description,sort_order,is_visible,kind,display_size,display_variant,file_name,file_size,file_mime,attachments,metadata,created_at,updated_at";

export const WORKSPACE_PAGE_SETTINGS_SELECT =
  "id,kicker,title,subtitle,footer,columns,updated_at";
