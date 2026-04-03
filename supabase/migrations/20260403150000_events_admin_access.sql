-- Владелец мероприятия + делегирование админам доступа к чужим мероприятиям.
alter table public.events
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

comment on column public.events.created_by is 'Profile id of admin/super_admin who created the event';
create index if not exists events_created_by_idx on public.events (created_by);

create table if not exists public.admin_event_access (
  admin_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (admin_id, event_id)
);

comment on table public.admin_event_access is 'Delegated event access for admins';
create index if not exists admin_event_access_event_id_idx on public.admin_event_access (event_id);
create index if not exists admin_event_access_admin_id_idx on public.admin_event_access (admin_id);
