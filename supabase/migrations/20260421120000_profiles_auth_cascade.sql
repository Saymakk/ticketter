-- Диагностика «осиротевших» учёток (Auth без profiles и наоборот).
-- Выполните в Supabase Dashboard → SQL Editor (облако).

-- 1) Auth-пользователи без профиля (частая причина «email already registered» + нет входа)
-- select u.id, u.email, u.created_at
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null
-- order by u.created_at desc;

-- 2) Профили без Auth (удалили только profiles вручную)
-- select p.id, p.full_name, p.phone, p.role
-- from public.profiles p
-- left join auth.users u on u.id = p.id
-- where u.id is null;

-- 3) Конкретный пользователь (подставьте id или email)
-- select id, email, created_at from auth.users where id = 'USER_UUID';
-- select id, full_name, phone, role from public.profiles where id = 'USER_UUID';
-- select id, full_name, phone, role from public.profiles where phone = '77011234567';

-- CASCADE: при удалении auth.users профиль удалится автоматически
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;
