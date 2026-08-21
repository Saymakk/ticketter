import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  parseAttachments,
  parseKind,
  parseSize,
  parseVariant,
} from "./layout";
import {
  WORKSPACE_PROJECT_SELECT,
  type WorkspaceProject,
  type WorkspaceProjectInput,
} from "./types";

function admin() {
  return createAdminSupabaseClient();
}

function mapProject(row: Record<string, unknown>): WorkspaceProject {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    url: String(row.url ?? ""),
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    description: typeof row.description === "string" ? row.description : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    is_visible: Boolean(row.is_visible),
    kind: parseKind(row.kind),
    display_size: parseSize(row.display_size),
    display_variant: parseVariant(row.display_variant),
    file_name: typeof row.file_name === "string" ? row.file_name : null,
    file_size: typeof row.file_size === "number" ? row.file_size : null,
    file_mime: typeof row.file_mime === "string" ? row.file_mime : null,
    attachments: parseAttachments(row.attachments),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function toPublicCard(project: WorkspaceProject) {
  return {
    id: project.id,
    name: project.name,
    url: project.url,
    thumbnail_url: project.thumbnail_url,
    description: project.description,
    sort_order: project.sort_order,
    kind: project.kind,
    display_size: project.display_size,
    display_variant: project.display_variant,
    file_name: project.file_name,
    file_size: project.file_size,
    file_mime: project.file_mime,
    attachments: project.attachments,
  };
}

export async function listVisibleProjects(): Promise<WorkspaceProject[]> {
  const { data, error } = await admin()
    .from("workspace_projects")
    .select(WORKSPACE_PROJECT_SELECT)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapProject(row as Record<string, unknown>));
}

export async function listAllProjects(): Promise<WorkspaceProject[]> {
  const { data, error } = await admin()
    .from("workspace_projects")
    .select(WORKSPACE_PROJECT_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapProject(row as Record<string, unknown>));
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function layoutPatch(input: Partial<WorkspaceProjectInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.kind !== undefined) patch.kind = parseKind(input.kind);
  if (input.display_size !== undefined) patch.display_size = parseSize(input.display_size);
  if (input.display_variant !== undefined) {
    patch.display_variant = parseVariant(input.display_variant);
  }
  if (input.file_name !== undefined) {
    patch.file_name = input.file_name?.trim() || null;
  }
  if (input.file_size !== undefined) {
    patch.file_size =
      typeof input.file_size === "number" && Number.isFinite(input.file_size)
        ? Math.round(input.file_size)
        : null;
  }
  if (input.file_mime !== undefined) {
    patch.file_mime = input.file_mime?.trim() || null;
  }
  if (input.attachments !== undefined) {
    patch.attachments = parseAttachments(input.attachments);
  }
  return patch;
}

export async function createProject(
  input: WorkspaceProjectInput,
  createdBy: string | null
): Promise<WorkspaceProject> {
  const name = input.name.trim();
  const url = normalizeUrl(input.url);
  if (!name) throw new Error("Название обязательно");
  if (!url) throw new Error("URL обязателен");

  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const { data: last } = await admin()
      .from("workspace_projects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? -1) + 1;
  }

  const { data, error } = await admin()
    .from("workspace_projects")
    .insert({
      name,
      url,
      thumbnail_url: input.thumbnail_url?.trim() || null,
      description: input.description?.trim() || null,
      sort_order: sortOrder,
      is_visible: input.is_visible ?? true,
      metadata: input.metadata ?? {},
      created_by: createdBy,
      updated_at: new Date().toISOString(),
      ...layoutPatch(input),
      kind: parseKind(input.kind),
      display_size: parseSize(input.display_size),
      display_variant: parseVariant(input.display_variant),
      file_name: input.file_name?.trim() || null,
      file_size:
        typeof input.file_size === "number" && Number.isFinite(input.file_size)
          ? Math.round(input.file_size)
          : null,
      file_mime: input.file_mime?.trim() || null,
      attachments: parseAttachments(input.attachments),
    })
    .select(WORKSPACE_PROJECT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapProject(data as Record<string, unknown>);
}

export async function updateProject(
  id: string,
  input: Partial<WorkspaceProjectInput>
): Promise<WorkspaceProject> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...layoutPatch(input),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Название обязательно");
    patch.name = name;
  }
  if (input.url !== undefined) {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error("URL обязателен");
    patch.url = url;
  }
  if (input.thumbnail_url !== undefined) {
    patch.thumbnail_url = input.thumbnail_url?.trim() || null;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.sort_order !== undefined) {
    patch.sort_order = input.sort_order;
  }
  if (input.is_visible !== undefined) {
    patch.is_visible = input.is_visible;
  }
  if (input.metadata !== undefined) {
    patch.metadata = input.metadata;
  }

  const { data, error } = await admin()
    .from("workspace_projects")
    .update(patch)
    .eq("id", id)
    .select(WORKSPACE_PROJECT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapProject(data as Record<string, unknown>);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await admin().from("workspace_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Reorder by ordered list of ids (index becomes sort_order). */
export async function reorderProjects(orderedIds: string[]): Promise<WorkspaceProject[]> {
  if (!orderedIds.length) return listAllProjects();

  const now = new Date().toISOString();
  await Promise.all(
    orderedIds.map((id, index) =>
      admin()
        .from("workspace_projects")
        .update({ sort_order: index, updated_at: now })
        .eq("id", id)
    )
  );

  return listAllProjects();
}
