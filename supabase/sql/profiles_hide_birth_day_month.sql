-- Stop med at dele præcise fødselsdatoer mellem brugere.
--
-- Enhver indlogget bruger kunne hente alle andres fødselsdag og -måned.
-- Appen bruger dem kun til at vise alder; alderen regnes nu ud af birth_year
-- alene og kan være ét år forkert indtil fødselsdagen.
--
-- Samme mønster som email-kolonnen: SELECT fjernes, mens INSERT og UPDATE
-- bevares, så brugeren selv kan gemme sin fødselsdato, og admins kan læse
-- den fulde dato gennem admin_profiles_with_email (SECURITY DEFINER, kører
-- som ejer og er derfor ikke bundet af kolonne-rettigheder).
--
-- Rækkefølge: frontend blev deployet først (commit 955ad86), så den ikke
-- længere beder om felterne. Køres denne før det deploy, fejler hver
-- profilhentning med "permission denied for column".

REVOKE SELECT (birth_month, birth_day) ON public.profiles FROM authenticated;
REVOKE SELECT (birth_month, birth_day) ON public.profiles FROM anon;

COMMENT ON COLUMN public.profiles.birth_month IS
  'Kun læsbar for service_role og via admin_profiles_with_email. Almindelige brugere ser kun birth_year.';
COMMENT ON COLUMN public.profiles.birth_day IS
  'Kun læsbar for service_role og via admin_profiles_with_email. Almindelige brugere ser kun birth_year.';
