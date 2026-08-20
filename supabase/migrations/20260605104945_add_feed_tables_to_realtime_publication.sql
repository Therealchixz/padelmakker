-- Enable Supabase Realtime (postgres_changes) for the home-feed source tables
-- so "Seneste aktivitet" can live-update when open matches / tournaments / leagues change.
--
-- match_results + notifications were already in the publication. RLS still governs
-- per-subscriber delivery, so users only receive changes to rows they may read.
-- These tables are low-volume, so there is no realtime throughput concern.

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.americano_tournaments;
alter publication supabase_realtime add table public.leagues;
