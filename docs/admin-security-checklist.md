# Admin-sikkerhed — tjekliste (PadelMakker)

Denne guide dækker ting **uden for app-koden**, som I bør have på plads sammen med PIN-gate og audit-log i databasen.

## Supabase Dashboard (organisation og projekt)

1. **To-faktor (MFA)** på alle Supabase-konti med adgang til projektet `hzmrsqrerkoftcppfklu`.
2. **Team-adgang**: Kun personer der skal være admin i appen; brug invite med mindst nødvendige roller.
3. **Rotér aldrig `service_role`** ind i frontend, GitHub Actions logs eller screenshots.
4. **Database passwords** og **API keys** kun i Vercel/Supabase secrets — ikke i chat eller issues.

## Auth (JWT)

1. Under **Authentication → Settings**, overvej **JWT expiry** på f.eks. **3600 sekunder (1 time)** for alle brugere.
2. Appen håndhæver desuden for **admin-rolle**: access token må højst være **8 timer gammel** (`iat` i JWT) før `is_admin()` returnerer false — admin skal logge ind / refresh fornyet token.
3. Efter password-reset eller mistanke om kompromittering: **sign out alle sessioner** for brugeren i Supabase Auth → Users.

## Admin i appen

| Lag | Beskrivelse |
|-----|-------------|
| Rolle | `profiles.role = 'admin'` |
| PIN | 6 cifre, lås efter 5 fejl |
| PIN-session | **30 min** (max **60** fra klient) |
| Følsomme RPC | Kræver `is_admin()` = rolle + PIN + JWT-alder |
| Audit | `admin_audit_log` + fanen **Admin-log** |

## Ved mistanke om misbrug

1. Fjern `role = 'admin'` på kompromitteret profil (SQL eller anden admin).
2. `DELETE FROM admin_pin_sessions WHERE user_id = '...';`
3. Gennemgå **Admin-log** og Supabase **Logs → Postgres / API**.
4. Skift password og tving logout i Auth.

## SQL ved behov

```sql
-- Se seneste admin-handlinger
SELECT * FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 50;

-- Ryd PIN-session for én admin
DELETE FROM public.admin_pin_sessions WHERE user_id = '<uuid>';
```
