-- Companies foundation with legacy backfill (Option A).

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text null,
  custom_data jsonb not null default '{}'::jsonb,
  is_legacy boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists companies_created_by_idx on public.companies(created_by);
create unique index if not exists companies_single_legacy_idx on public.companies(is_legacy) where is_legacy = true;

create table if not exists public.admin_company_access (
  admin_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  all_events boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (admin_id, company_id)
);

create index if not exists admin_company_access_company_idx on public.admin_company_access(company_id);
create index if not exists admin_company_access_admin_idx on public.admin_company_access(admin_id);

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists profiles_company_id_idx on public.profiles(company_id);

do $$
declare
  legacy_company_id uuid;
begin
  select id into legacy_company_id
  from public.companies
  where is_legacy = true
  limit 1;

  if legacy_company_id is null then
    insert into public.companies(name, is_legacy)
    values ('Без компании (legacy)', true)
    returning id into legacy_company_id;
  end if;

  alter table public.events
    add column if not exists company_id uuid;

  update public.events
  set company_id = legacy_company_id
  where company_id is null;

  alter table public.events
    alter column company_id set not null;

  if not exists (
    select 1 from pg_constraint
    where conname = 'events_company_id_fkey'
  ) then
    alter table public.events
      add constraint events_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete restrict;
  end if;

  create index if not exists events_company_id_idx on public.events(company_id);

  alter table public.tickets
    add column if not exists company_id uuid;

  update public.tickets t
  set company_id = e.company_id
  from public.events e
  where t.event_id = e.id
    and t.company_id is null;

  alter table public.tickets
    alter column company_id set not null;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tickets_company_id_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete restrict;
  end if;

  create index if not exists tickets_company_id_idx on public.tickets(company_id);
end $$;

create or replace function public.tickets_sync_company_id()
returns trigger
language plpgsql
as $$
begin
  if new.event_id is not null then
    select e.company_id into new.company_id
    from public.events e
    where e.id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_sync_company_id on public.tickets;
create trigger trg_tickets_sync_company_id
before insert or update of event_id
on public.tickets
for each row
execute function public.tickets_sync_company_id();

