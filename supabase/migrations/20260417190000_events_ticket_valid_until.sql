alter table public.events
  add column if not exists ticket_valid_until date;

update public.events
set ticket_valid_until = (event_date::date + 1)
where ticket_valid_until is null;

alter table public.events
  alter column ticket_valid_until set not null;

comment on column public.events.ticket_valid_until is
  'Дата, до конца которой билет действителен (UTC). Должна быть строго позже event_date.';
