-- Mini-constructor for myworkspace.su: block kind/size/variant, attachments, page copy

alter table public.workspace_projects
  add column if not exists kind text not null default 'site',
  add column if not exists display_size text not null default 'm',
  add column if not exists display_variant text not null default 'card',
  add column if not exists file_name text null,
  add column if not exists file_size bigint null,
  add column if not exists file_mime text null,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.workspace_projects
  drop constraint if exists workspace_projects_kind_check;
alter table public.workspace_projects
  add constraint workspace_projects_kind_check check (kind in ('site', 'file'));

alter table public.workspace_projects
  drop constraint if exists workspace_projects_display_size_check;
alter table public.workspace_projects
  add constraint workspace_projects_display_size_check
  check (display_size in ('s', 'm', 'l', 'xl'));

alter table public.workspace_projects
  drop constraint if exists workspace_projects_display_variant_check;
alter table public.workspace_projects
  add constraint workspace_projects_display_variant_check
  check (display_variant in ('card', 'compact', 'wide', 'tile'));

comment on column public.workspace_projects.kind is
  'site = external link, file = downloadable attachment';
comment on column public.workspace_projects.display_size is
  'Grid span: s/m = 1 col, l = 2 cols, xl = full width';
comment on column public.workspace_projects.display_variant is
  'Card visual: card, compact, wide banner, tile';
comment on column public.workspace_projects.attachments is
  'Extra downloadable files shown on the block [{url,name,size,mime}]';

create table if not exists public.workspace_page_settings (
  id smallint primary key default 1 check (id = 1),
  kicker text not null default 'myworkspace',
  title text not null default 'Workspace',
  subtitle text not null default 'Все проекты в одном месте.',
  footer text not null default 'myworkspace.su',
  columns smallint not null default 3 check (columns in (2, 3, 4)),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_page_settings is
  'Singleton copy and grid settings for the myworkspace.su homepage';

insert into public.workspace_page_settings (id)
values (1)
on conflict (id) do nothing;
