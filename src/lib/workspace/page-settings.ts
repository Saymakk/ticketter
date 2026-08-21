import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clipText, parseColumns } from "./layout";
import {
  WORKSPACE_PAGE_SETTINGS_SELECT,
  type WorkspacePageSettings,
  type WorkspacePageSettingsInput,
} from "./types";

const DEFAULTS = {
  id: 1,
  kicker: "myworkspace",
  title: "Workspace",
  subtitle: "Все проекты в одном месте.",
  footer: "myworkspace.su",
  columns: 3 as const,
};

function admin() {
  return createAdminSupabaseClient();
}

function mapSettings(row: Record<string, unknown>): WorkspacePageSettings {
  return {
    id: 1,
    kicker: String(row.kicker ?? DEFAULTS.kicker),
    title: String(row.title ?? DEFAULTS.title),
    subtitle: String(row.subtitle ?? DEFAULTS.subtitle),
    footer: String(row.footer ?? DEFAULTS.footer),
    columns: parseColumns(row.columns),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function defaultPageSettings(): WorkspacePageSettings {
  return {
    ...DEFAULTS,
    updated_at: "",
  };
}

export async function getPageSettings(): Promise<WorkspacePageSettings> {
  const { data, error } = await admin()
    .from("workspace_page_settings")
    .select(WORKSPACE_PAGE_SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const { data: inserted, error: insertError } = await admin()
      .from("workspace_page_settings")
      .insert(DEFAULTS)
      .select(WORKSPACE_PAGE_SETTINGS_SELECT)
      .single();
    if (insertError) throw new Error(insertError.message);
    return mapSettings(inserted as Record<string, unknown>);
  }
  return mapSettings(data as Record<string, unknown>);
}

export async function updatePageSettings(
  input: WorkspacePageSettingsInput
): Promise<WorkspacePageSettings> {
  await getPageSettings();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.kicker !== undefined) patch.kicker = clipText(input.kicker, 80) || DEFAULTS.kicker;
  if (input.title !== undefined) patch.title = clipText(input.title, 120) || DEFAULTS.title;
  if (input.subtitle !== undefined) patch.subtitle = clipText(input.subtitle, 500);
  if (input.footer !== undefined) patch.footer = clipText(input.footer, 200);
  if (input.columns !== undefined) patch.columns = parseColumns(input.columns);

  const { data, error } = await admin()
    .from("workspace_page_settings")
    .update(patch)
    .eq("id", 1)
    .select(WORKSPACE_PAGE_SETTINGS_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapSettings(data as Record<string, unknown>);
}
