-- Fjern gamle 5-parameter overloads så kun entity-versionen af RPC'erne findes.
-- (CREATE OR REPLACE med nye parametre opretter en ekstra signatur i Postgres.)

DROP FUNCTION IF EXISTS public.create_notification_for_user(uuid, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_notifications_for_users(uuid[], text, text, text, uuid);
