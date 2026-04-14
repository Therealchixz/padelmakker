-- Synkroniser completed_at med det faktiske tidspunkt for resultat-indrapporteringen.
-- Dette rydder op i rækkefølgen så de nyeste spillede kampe ligger øverst i Admin Panelet.

UPDATE public.matches m
SET completed_at = mr.created_at
FROM public.match_results mr
WHERE m.id = mr.match_id 
AND m.status = 'completed';

-- Bekræftelse af at fremtidige kampe også får sat completed_at via funktionen
-- (Husk at køre apply_elo_dynamic_k.sql igen hvis du ikke har gjort det endnu)
