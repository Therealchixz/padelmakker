-- Browser Push Notifications: push_subscriptions table
-- Kør dette i Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Brugere kan kun se og redigere egne subscriptions
CREATE POLICY "push_subscriptions: bruger kan styre egne"
  ON public.push_subscriptions
  FOR ALL
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Index til opslag pr. bruger (Edge Function bruger service_role og bypasser RLS)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);
