# Aftaler med ejeren

- **Forklar alt i hverdagssprog.** Ejeren har ingen kodningsviden. Undgå fagudtryk, eller forklar dem kort. Fortæl hvad der virker, hvad der ikke virker, og præcis hvad ejeren selv skal gøre (trin for trin), hvis noget.
- **Merge selv.** Når du har lavet en ændring: opret PR, vent til alle checks er grønne og der ingen merge-konflikter er, sæt PR til "ready for review" og merge den (squash) uden at spørge først. Er noget rødt, så ret det først. Kan det ikke rettes, så forklar ejeren hvorfor.

# Design-skills (ejeren 4. nov. 2026)

Brug design-skillsene i `.claude/skills/`, når du designer eller ændrer hjemmesiden og appen:

- **impeccable**: samlede vurderinger (`critique`), tekniske tjek (`audit`) og pudsning af eksisterende sider og app-skærme.
- **design-taste-frontend** (taste-skill): kunstnerisk retning for offentlige sider (forside, events, om, FAQ) og nye skærme. PadelMakker har allerede et brand, så kør altid `draw.mjs` med `--keep palette,type`.
- **Emil Kowalskis skills**: `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `choreograph` og `animation-performance` til bevægelse. `mobile-native` gør, at appen føles som en app på telefonen. `break-ui` tester sider med ekstreme data. `emil-design-eng` og `apple-design` dækker detaljer og finish.

Ejerens valg går altid forud for en skills egen husstil. Ejeren valgte 15. nov. 2026 designet "H" fra Claude Design-lærredet "PadelMakker – tre retninger" (bygges i etaper). Det afløser papir/ler-designet fra 4. nov. 2026:

- farver: lys blågrå bund (`--pm-bg`), hvide kort (`--pm-surface`), mørk navy (`--pm-ink`, `--pm-text`), blå til knapper og links (`--pm-accent-solid`, `--pm-accent`) og lime (`--pm-lime`, altid med mørk tekst `--pm-on-lime`) til "spil nu / det er dit". De gamle navne `--pm-clay`, `--pm-paper` og `--pm-ball` findes stadig, men peger nu på blå, lys bund og lime
- skrift: Bricolage Grotesque (fed, almindelige store/små bogstaver) til overskrifter og store tal, Schibsted Grotesk til tekst. Ingen versaler-overskrifter og ingen `tabular-nums` (giver huller i "19:30")
- det gamle baggrundsfoto på forsiden (ikke en tegnet bane)
- padel-ikonet "B" (skrå, fyldt ketsjer) som standardbillede
- den fælles toplinje (`ScreenHeader`) på appens hovedsider, sammen med bundmenuen Hjem · Kampe · Spil · Makkere · Mere, hvor Spil er en lime knap
- kun rigtige tal og navne på offentlige sider; eksempeldata mærkes "Eksempel"

Etaper: 1) farver, skrift og bundmenu i hele appen, 2) Hjem og Spil/opret-siderne, 3) resten af skærmene. Hver etape er sin egen kladde-PR, som ejeren ser og godkender, før den merges (undtagelse fra "Merge selv").

Spørg ejeren, før du laver store om-designs eller skifter farver, skrift eller billeder.
