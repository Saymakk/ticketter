-- Workspace portal: add Healthy Life as a catalog entry (idempotent by URL)

insert into public.workspace_projects (name, url, description, sort_order, is_visible)
select
  'Healthy Life',
  'https://healthy-life.myworkspace.su',
  'Дневник питания: фото еды, ИИ-оценка калорий, вес и советы',
  1,
  true
where not exists (
  select 1
  from public.workspace_projects
  where url = 'https://healthy-life.myworkspace.su'
);
