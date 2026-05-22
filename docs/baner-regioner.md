# Regioner under Book bane

PadelMakker grupperer centre efter **landsdele** (Danmarks Statistik, NUTS niveau 3), ikke de fem store regioner alene.

## Rækkefølge i appen

Defineret i `src/lib/banerRegions.js`:

1. **Nordjylland** — Region Nordjylland
2. **Vestjylland** — Herning, Holstebro, Lemvig, Ringkøbing-Skjern, Skive, Struer, Viborg, Ikast-Brande (Region Midtjylland, vest)
3. **Østjylland** — Aarhus, Randers, Horsens, Silkeborg, Djursland/Favrskov m.fl. (Region Midtjylland, øst)
4. **Sønderjylland** — syd for Kongeå + Syddanmarks jyske kommuner (ikke Fyn)
5. **Fyn** — inkl. Langeland, Ærø i Padellife-oversigten
6. **Sjælland** — Region Sjælland uden Bornholm
7. **Hovedstaden** — København og Storkøbenhavn
8. **Bornholm**

«Midtjylland» bruges **ikke** som overskrift — det svarer i praksis til Vest- + Østjylland.

## Typer af centre

| Type | I listen |
|------|----------|
| `halbooking` / `matchi` / `bookli` | Ledige tider i appen (når API virker) |
| `link` | Hele Padellife-kataloget (~130 centre) med «Åbn booking» |

Link-data genereres:

```bash
node scripts/build-baner-link-catalog.mjs
```

Kilde: [Padellife — oversigt over padelbaner](https://padellife.dk/blogs/tips-og-tricks/oversigt-over-padelbaner-i-danmark) (gemmes i `scripts/data/padellife-baner-oversigt.md`).

## Referencer

- [DST NUTS / landsdele](https://www.dst.dk/da/Statistik/dokumentation/nomenklaturer/nuts)
- [WannaSport Danmark](https://www.wannasport.com/dnk/da)
