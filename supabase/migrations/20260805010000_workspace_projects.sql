-- Workspace portal: catalog of projects shown on myworkspace.su

create table if not exists public.workspace_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  thumbnail_url text null,
  description text null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  -- Reserved for future card fields / project types without schema churn
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_projects_sort_idx
  on public.workspace_projects (sort_order asc, created_at asc);

create index if not exists workspace_projects_visible_idx
  on public.workspace_projects (is_visible)
  where is_visible = true;

comment on table public.workspace_projects is
  'Projects shown on the myworkspace.su portal catalog';

-- Seed Ticketter as the first catalog entry (idempotent by URL)
insert into public.workspace_projects (name, url, description, sort_order, is_visible)
select
  'Ticketter',
  'https://ticketter.myworkspace.su',
  'Учёт билетов и сканирование QR',
  0,
  true
where not exists (
  select 1
  from public.workspace_projects
  where url = 'https://ticketter.myworkspace.su'
);
