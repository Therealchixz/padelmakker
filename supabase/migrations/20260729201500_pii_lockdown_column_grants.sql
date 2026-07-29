-- Effective PII lockdown: table-level SELECT must be replaced with column grants
-- (REVOKE SELECT (email) alone does not override GRANT SELECT ON TABLE).

REVOKE SELECT ON TABLE public.profiles FROM anon;
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC;

GRANT SELECT (
  id, name, full_name, level, play_style, area, city, availability, available_days,
  bio, avatar_emoji, avatar, elo_rating, americano_elo_rating,
  games_played, games_won, games_lost, best_streak, current_streak, created_at,
  birth_year, birth_month, birth_day, court_side,
  americano_wins, americano_losses, americano_draws, americano_played,
  role, is_banned, ban_reason, latitude, longitude, travel_willing,
  intent_now, seeking_match, seeking_match_at, last_active_at,
  preferred_partner_level, phone_verification_exempt, notification_prefs,
  match_watch_enabled, match_watch_at, makker_search_prefs,
  makker_watch_enabled, makker_watch_at, match_search_prefs
) ON public.profiles TO authenticated;

-- anon: no profile email scraping. Intentionally no SELECT grant to anon on profiles.

REVOKE SELECT ON TABLE public.match_players FROM anon;
REVOKE SELECT ON TABLE public.match_players FROM authenticated;
REVOKE SELECT ON TABLE public.match_players FROM PUBLIC;

GRANT SELECT (
  id, match_id, user_id, user_name, user_emoji, joined_at, team
) ON public.match_players TO authenticated;

NOTIFY pgrst, 'reload schema';
