-- Liste admin-bruger-id'er (til push ved konsol-flags m.m.)
-- Kør i Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION public.admin_list_admin_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admins med aktiv PIN-session';
  END IF;

  RETURN coalesce(
    array_agg(p.id ORDER BY p.id),
    ARRAY[]::uuid[]
  )
  FROM public.profiles p
  WHERE lower(COALESCE(p.role, '')) = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_admin_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_admin_ids() TO authenticated;
