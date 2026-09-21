-- app_config rummer notifikationssystemets hemmeligheder: reminder_cron_secret
-- (den delte noegle der beskytter send-reminders, send-reactivation og dispatch-push)
-- og anon_key.
--
-- Tabellen har RLS slaaet til uden en eneste politik, saa ingen kan LAESE den gennem
-- API'et. Det virker. Men GRANT-listen stod stadig aaben: anon og authenticated havde
-- SELECT, INSERT, UPDATE, DELETE og TRUNCATE.
--
-- RLS gaelder ikke TRUNCATE. Rettigheden er den eneste kontrol dér. Det er ikke
-- naaeligt gennem PostgREST, som kun udsteder select/insert/update/delete, saa der er
-- ikke noget hul i dag - men den eneste ting der staar mellem en tom app_config og
-- et doedt notifikationssystem, boer ikke vaere "API'et tilbyder ikke den knap".
--
-- Ingen udrulningsraekkefoelge at tage hensyn til: frontenden naevner ikke app_config
-- én eneste gang. Edge-funktionerne laeser den med service_role (uden om RLS og uden
-- om disse grants), og cron-jobbene laeser den inde i databasen som postgres.

REVOKE ALL ON public.app_config FROM anon;
REVOKE ALL ON public.app_config FROM authenticated;
