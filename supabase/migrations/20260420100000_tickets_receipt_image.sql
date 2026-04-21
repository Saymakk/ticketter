alter table public.tickets
  add column if not exists receipt_image_url text null;
