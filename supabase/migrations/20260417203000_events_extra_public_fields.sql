alter table public.events
  add column if not exists address text null,
  add column if not exists dress_code text null,
  add column if not exists description text null,
  add column if not exists social_links jsonb not null default '[]'::jsonb;

comment on column public.events.address is 'Адрес мероприятия';
comment on column public.events.dress_code is 'Дресс-код мероприятия';
comment on column public.events.description is 'Описание мероприятия';
comment on column public.events.social_links is 'Массив ссылок соцсетей (URL)';
