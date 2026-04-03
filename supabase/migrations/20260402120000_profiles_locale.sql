-- Язык интерфейса: ru | kk | en
alter table public.profiles
  add column if not exists locale text not null default 'ru'
  check (locale in ('ru', 'kk', 'en'));

comment on column public.profiles.locale is 'UI language: ru, kk, en';
