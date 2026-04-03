-- Опциональное время начала мероприятия (формат HH:MM, локальное)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_time text;

COMMENT ON COLUMN public.events.event_time IS 'Опционально: время начала (HH:MM)';

-- Журнал действий для суперадмина (запись через service role из API)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  path text,
  method text,
  metadata jsonb,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON public.audit_logs (resource_type, resource_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
