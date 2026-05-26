-- Триггер handle_new_user ломал auth.admin.createUser с ошибкой
-- «Database error creating new user» (NOT NULL / role / RLS в profiles).
-- Профиль создаёт приложение через API сразу после createUser.
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user();
