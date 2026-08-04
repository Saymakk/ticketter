/** Workspace portal project card */

export type WorkspaceProject = {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Public-facing card (no admin-only fields required by UI) */
export type WorkspaceProjectCard = Pick<
  WorkspaceProject,
  "id" | "name" | "url" | "thumbnail_url" | "description" | "sort_order"
>;

export type WorkspaceProjectInput = {
  name: string;
  url: string;
  thumbnail_url?: string | null;
  description?: string | null;
  sort_order?: number;
  is_visible?: boolean;
  metadata?: Record<string, unknown>;
};

export const WORKSPACE_PROJECT_SELECT =
  "id,name,url,thumbnail_url,description,sort_order,is_visible,metadata,created_at,updated_at";
