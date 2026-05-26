-- Пароль, заданный через админку (Supabase Auth хранит только хэш).
alter table public.profiles
  add column if not exists managed_password text null;

comment on column public.profiles.managed_password is
  'Last plaintext password set via admin UI; not used for auth verification.';

-- Профиль создаёт приложение через POST /api/admin/users/create (сразу после createUser).
-- Триггер на auth.users не используем: ломает createUser («Database error creating new user»).
-- RLS: пользователь читает только свой профиль (для client-side запросов).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;
