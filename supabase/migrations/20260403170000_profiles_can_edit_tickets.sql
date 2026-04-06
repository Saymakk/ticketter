-- Право пользователя (роль user) создавать/редактировать/удалять билеты и связанные операции.
-- Админы и суперадмины не ограничиваются этим флагом.
alter table public.profiles
  add column if not exists can_edit_tickets boolean not null default true;

comment on column public.profiles.can_edit_tickets is
  'For role user: if false, only view tickets and use scanner (no create/edit/delete/export/duplicate/bulk QR).';
