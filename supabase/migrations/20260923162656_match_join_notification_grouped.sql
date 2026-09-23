-- Én "tilmeldt"-besked pr. kamp i stedet for én pr. spiller.
--
-- Før: hver tilmelding gav opretteren en ny række ("Ny spiller tilmeldt!").
-- Samme spiller, der meldte sig af og til igen, gav tre ens beskeder.
--
-- Nu opdateres opretterens ene match_join-besked for kampen, så den altid
-- viser den aktuelle stilling, fx
--   "2 spillere har tilmeldt sig din kamp"
--   "Mike Pedersen og Anna Hansen · 1 plads tilbage"
-- og hopper øverst som ulæst igen. Teksten bygges her ud fra match_players,
-- så den er korrekt, uanset hvem der har meldt sig af undervejs.
--
-- Funktionen returnerer nu {notify, title, body}, så klienten kan sende push
-- med samme tekst. p_title/p_body beholdes i signaturen, så ældre klienter
-- (cachet PWA) stadig kan kalde den; de bruges ikke længere.

DROP FUNCTION IF EXISTS public.notify_match_creator_on_join(uuid, text, text);

CREATE FUNCTION public.notify_match_creator_on_join(p_match_id uuid, p_title text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_creator uuid;
  v_joiner uuid;
  v_max integer;
  v_current integer;
  v_names text[];
  v_count integer;
  v_left integer;
  v_names_text text;
  v_title text;
  v_body text;
  v_existing public.notifications%ROWTYPE;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('match_creator_join_notify', 20, 3600);
  END IF;

  SELECT m.creator_id, COALESCE(m.max_players, 4), COALESCE(m.current_players, 0)
    INTO v_creator, v_max, v_current
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL OR v_creator = v_joiner THEN
    RETURN jsonb_build_object('notify', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_joiner
  ) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;

  -- Alle tilmeldte undtagen opretteren, i den rækkefølge de kom.
  SELECT array_agg(n ORDER BY j, uid)
    INTO v_names
  FROM (
    SELECT
      COALESCE(NULLIF(btrim(mp.user_name), ''), NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.name), ''), 'En spiller') AS n,
      mp.joined_at AS j,
      mp.user_id AS uid
    FROM public.match_players mp
    LEFT JOIN public.profiles p ON p.id = mp.user_id
    WHERE mp.match_id = p_match_id
      AND mp.user_id IS DISTINCT FROM v_creator
  ) s;

  v_count := COALESCE(array_length(v_names, 1), 0);
  IF v_count = 0 THEN
    RETURN jsonb_build_object('notify', false);
  END IF;

  v_names_text := CASE
    WHEN v_count = 1 THEN v_names[1]
    WHEN v_count <= 3 THEN array_to_string(v_names[1:v_count - 1], ', ') || ' og ' || v_names[v_count]
    ELSE array_to_string(v_names[1:2], ', ') || ' og ' || (v_count - 2) || ' andre'
  END;

  v_left := GREATEST(0, v_max - GREATEST(v_current, v_count + 1));

  v_title := CASE
    WHEN v_count = 1 THEN '1 spiller har tilmeldt sig din kamp'
    ELSE v_count || ' spillere har tilmeldt sig din kamp'
  END;
  v_body := v_names_text || ' · ' || CASE
    WHEN v_left = 0 THEN 'kampen er fuld'
    WHEN v_left = 1 THEN '1 plads tilbage'
    ELSE v_left || ' pladser tilbage'
  END;

  SELECT * INTO v_existing
  FROM public.notifications n
  WHERE n.user_id = v_creator
    AND n.match_id = p_match_id
    AND n.type = 'match_join'
  ORDER BY n.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Samme tekst inden for 3 minutter (fx af- og tilmelding): ingen ny besked.
    IF v_existing.title = v_title
       AND v_existing.body = v_body
       AND v_existing.created_at > now() - interval '3 minutes' THEN
      RETURN jsonb_build_object('notify', false, 'title', v_title, 'body', v_body);
    END IF;

    UPDATE public.notifications
    SET title = v_title,
        body = v_body,
        read = false,
        created_at = now()
    WHERE id = v_existing.id;

    -- Rester fra før samlingen: kun én besked pr. kamp.
    DELETE FROM public.notifications n
    WHERE n.user_id = v_creator
      AND n.match_id = p_match_id
      AND n.type = 'match_join'
      AND n.id <> v_existing.id;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (v_creator, 'match_join', v_title, v_body, p_match_id, false);
  END IF;

  RETURN jsonb_build_object('notify', true, 'title', v_title, 'body', v_body);
END;
$fn$;

ALTER FUNCTION public.notify_match_creator_on_join(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO service_role;

-- Oprydning: gamle, separate "tilmeldt"-beskeder samles til den nyeste pr.
-- opretter og kamp. Den er ulæst, hvis blot én af dem var det.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY user_id, match_id ORDER BY created_at DESC, id) AS rn,
    bool_and(read) OVER (PARTITION BY user_id, match_id) AS all_read
  FROM public.notifications
  WHERE type = 'match_join' AND match_id IS NOT NULL
),
keep AS (
  UPDATE public.notifications n
  SET read = r.all_read
  FROM ranked r
  WHERE n.id = r.id AND r.rn = 1 AND n.read IS DISTINCT FROM r.all_read
  RETURNING n.id
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;
