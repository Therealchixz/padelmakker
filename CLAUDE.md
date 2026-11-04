# Aftaler med ejeren

- **Forklar alt i hverdagssprog.** Ejeren har ingen kodningsviden. Undgå fagudtryk, eller forklar dem kort. Fortæl hvad der virker, hvad der ikke virker, og præcis hvad ejeren selv skal gøre (trin for trin), hvis noget.
- **Merge selv.** Når du har lavet en ændring: opret PR, vent til alle checks er grønne og der ingen merge-konflikter er, sæt PR til "ready for review" og merge den (squash) uden at spørge først. Er noget rødt, så ret det først. Kan det ikke rettes, så forklar ejeren hvorfor.

# Design-skills (ejeren 4. nov. 2026)

Brug design-skillsene i `.claude/skills/`, når du designer eller ændrer hjemmesiden og appen:

- **impeccable**: samlede vurderinger (`critique`), tekniske tjek (`audit`) og pudsning af eksisterende sider og app-skærme.
- **design-taste-frontend** (taste-skill): kunstnerisk retning for offentlige sider (forside, events, om, FAQ) og nye skærme. PadelMakker har allerede et brand, så kør altid `draw.mjs` med `--keep palette,type`.
- **Emil Kowalskis skills**: `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `choreograph` og `animation-performance` til bevægelse. `mobile-native` gør, at appen føles som en app på telefonen. `break-ui` tester sider med ekstreme data. `emil-design-eng` og `apple-design` dækker detaljer og finish.

Ejerens tidligere valg går altid forud for en skills egen husstil:

- det gamle baggrundsfoto på forsiden (ikke en tegnet bane)
- skriften Bricolage Grotesque på overskrifter (`.pm-brand`)
- orange accent (`--pm-orange`) og navy som hovedfarve
- padel-ikonet "B" (skrå, fyldt ketsjer) som standardbillede
- den fælles toplinje (`ScreenHeader`) på appens hovedsider

Spørg ejeren, før du laver store om-designs eller skifter farver, skrift eller billeder.
