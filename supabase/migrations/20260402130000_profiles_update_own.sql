-- Разрешить пользователю обновлять свою строку в profiles (в т.ч. locale).
-- Если политика уже есть в проекте — пропустите или объедините вручную.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;
