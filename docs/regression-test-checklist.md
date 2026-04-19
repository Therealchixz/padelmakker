# PadelMakker regression-test checkliste

Brug denne checkliste efter ændringer for hurtigt at bekræfte, at kritiske flows stadig virker.

## 1) Basis checks (lokalt)

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

Alle tre skal være grønne før merge.

## 2) Auth + routing

1. Opret bruger via onboarding.
2. Log ind med eksisterende bruger.
3. Verificér at logout sender brugeren til forsiden.
4. Verificér at deep links til `/dashboard/...` kræver login.

## 3) Kampe (2v2)

1. Opret en åben kamp.
2. Tilmeld 2 spillere pr. hold.
3. Start kampen.
4. Indrapportér resultat.
5. Bekræft resultat fra anden spiller.
6. Tjek at kamp bliver afsluttet og ELO opdateres.

## 4) "Råb op — mangler 1 spiller"

1. Opret kamp med ledig plads.
2. Tryk "Råb op — mangler 1 spiller".
3. Verificér at afsender får success-toast.
4. Verificér at modtager får in-app notifikation.
5. Verificér at modtager får push (hvis push er aktiveret).

## 5) Liga / Swiss

1. Opret liga med mindst 4 hold.
2. Start liga og generér runde 1.
3. Indrapportér alle resultater.
4. Generér næste runde.
5. Afslut liga og bekræft at rangliste vises korrekt.

## 6) Makkere og profil

1. Skift profilfelter (intent, seeking, city, availability).
2. Gem profil.
3. Åbn Makkere og verificér at filtre + forslag stadig fungerer.

## 7) Notifikationer

1. Åbn klokken og bekræft læs/ryd flows.
2. Test push opt-in/opt-out.
3. Bekræft at badge-count opdateres.

## 8) Mobil / responsiv

1. Test på iPhone-bredde.
2. Test på Android-bredde.
3. Verificér at header/navigation ikke overlapper.

## 9) Production sanity (efter deploy)

1. Åbn siden i inkognito.
2. Log ind med testbruger.
3. Kør et hurtigt "happy path" (opret kamp + notifikation).
4. Tjek browser console for fejl.
