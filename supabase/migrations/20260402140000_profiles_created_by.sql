-- Кто создал профиль (для права админа удалять только «своих» пользователей)
alter table public.profiles
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.created_by is 'Profile id of the admin/manager who created this user';

create index if not exists profiles_created_by_idx on public.profiles (created_by);
