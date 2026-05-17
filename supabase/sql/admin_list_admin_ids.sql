-- Liste admin-bruger-id'er (til push ved konsol-flags m.m.)
-- Kør i Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION public.admin_list_admin_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[])
  FROM public.profiles p
  WHERE lower(COALESCE(p.role, '')) = 'admin';
$$;

REVOKE ALL ON FUNCTION public.admin_list_admin_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_admin_ids() TO authenticated;
