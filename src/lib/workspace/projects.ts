import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  WORKSPACE_PROJECT_SELECT,
  type WorkspaceProject,
  type WorkspaceProjectInput,
} from "./types";

function admin() {
  return createAdminSupabaseClient();
}

export async function listVisibleProjects(): Promise<WorkspaceProject[]> {
  const { data, error } = await admin()
    .from("workspace_projects")
    .select(WORKSPACE_PROJECT_SELECT)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceProject[];
}

export async function listAllProjects(): Promise<WorkspaceProject[]> {
  const { data, error } = await admin()
    .from("workspace_projects")
    .select(WORKSPACE_PROJECT_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceProject[];
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
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
    })
    .select(WORKSPACE_PROJECT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as WorkspaceProject;
}

export async function updateProject(
  id: string,
  input: Partial<WorkspaceProjectInput>
): Promise<WorkspaceProject> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
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
  return data as WorkspaceProject;
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
