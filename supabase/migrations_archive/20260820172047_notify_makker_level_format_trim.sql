/** Niveau uden efterladt komma/nul: 3.0 → "3", 3.5 → "3.5". */
CREATE OR REPLACE FUNCTION public.format_padel_level(p_level numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT rtrim(rtrim(to_char(COALESCE(p_level, 0), 'FM9.9'), '0'), '.');
$function$;

REVOKE ALL ON FUNCTION public.format_padel_level(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.format_padel_level(numeric) TO authenticated;
