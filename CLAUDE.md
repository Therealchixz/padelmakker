# Aftaler med ejeren

- **Forklar alt i hverdagssprog.** Ejeren har ingen kodningsviden. Undgå fagudtryk, eller forklar dem kort. Fortæl hvad der virker, hvad der ikke virker, og præcis hvad ejeren selv skal gøre (trin for trin), hvis noget.
- **Merge selv.** Når du har lavet en ændring: opret PR, vent til alle checks er grønne og der ingen merge-konflikter er, sæt PR til "ready for review" og merge den (squash) uden at spørge først. Er noget rødt, så ret det først. Kan det ikke rettes, så forklar ejeren hvorfor.

# Design-skills (ejeren 4. nov. 2026)

Brug design-skillsene i `.claude/skills/`, når du designer eller ændrer hjemmesiden og appen:

- **impeccable**: samlede vurderinger (`critique`), tekniske tjek (`audit`) og pudsning af eksisterende sider og app-skærme.
- **design-taste-frontend** (taste-skill): kunstnerisk retning for offentlige sider (forside, events, om, FAQ) og nye skærme. PadelMakker har allerede et brand, så kør altid `draw.mjs` med `--keep palette,type`.
- **Emil Kowalskis skills**: `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `choreograph` og `animation-performance` til bevægelse. `mobile-native` gør, at appen føles som en app på telefonen. `break-ui` tester sider med ekstreme data. `emil-design-eng` og `apple-design` dækker detaljer og finish.

Ejerens valg går altid forud for en skills egen husstil. Ejeren valgte 4. nov. 2026 redesignet fra Claude Design-prototypen "PadelMakker Prototype v4" (bygges i trin, se `PRODUCT.md`). Prototypen er en retning, ikke en skabelon, der skal følges 100 %:

- farver: papir (`--pm-bg`), blæk (`--pm-ink`) og lerfarve (`--pm-accent-solid`, `--pm-clay`) i stedet for navy
- skrift: Anton (versaler) på overskrifter på de offentlige sider (`.pm-brand`), Figtree til tekst, tal og tider (ejeren valgte Figtree 9. nov. 2026; tal med faste cifferbredder, ingen maskinskrift)
- det gamle baggrundsfoto på forsiden (ikke en tegnet bane)
- padel-ikonet "B" (skrå, fyldt ketsjer) som standardbillede
- den fælles toplinje (`ScreenHeader`) på appens hovedsider, sammen med bundmenuen Hjem · Kampe · Spil · Makkere · Mere
- kun rigtige tal og navne på offentlige sider; eksempeldata mærkes "Eksempel"

Spørg ejeren, før du laver store om-designs eller skifter farver, skrift eller billeder.
