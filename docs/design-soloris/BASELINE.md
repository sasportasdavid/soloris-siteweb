# Baseline du chantier design V3

| Élément | Valeur |
|---|---|
| Dépôt | `sasportasdavid/soloris-siteweb` (remote `origin`) |
| `BASE_SHA` (figé, voir `BASE_SHA`) | `52ec190e00daf207cdb390dd7fbfd1ce409a4a7e` |
| Contenu | `main` après fusion du dossier éditorial V2 (PR #71), déployé en production le 15/10/2026 |
| Commit audité par le cahier | `538233e` — ancêtre de la baseline ; aucun retour arrière effectué |
| Chantier wording | **appliqué** (lots 0–6 de la PR #71) : la baseline design le contient |
| Branche de travail | `design/v3` |
| Consignes du dépôt | pas de `CLAUDE.md` ; README et `docs/controles/README.md` |
| Pièces du dossier V3 non fournies | `controles/garde_fou_design.py` (remplacé par `scripts/controles/perimetre-design.mjs`), `referentiels/recette_design.csv` (51 scénarios), `referentiels/couverture_design_62_URL.csv`, `referentiels/soloris-design-v3.example.css`, `reference_editoriale/` (textes déjà intégrés via la PR #71) |

## Fichiers gelés (empreintes Git à la baseline)

| Fichier | Empreinte |
|---|---|
| `src/components/QuoteForm.astro` | `a54f6e2580507f86de29dfe5d1f6d5a26d2d3479` |
| `src/components/CallbackForm.astro` | `5f5e3d9d38f622b5804bcf437349bf0f0bb79858` |
| `src/components/ContactForm.astro` | `0744856d27353f61124df00ecf8f219f9bec604c` |
| `src/components/ChatWidget.astro` | `a8a958c71c9ddd8fb296f266aff63bc67860f5dd` |
| `src/components/Analytics.astro` | `a80cd344c679744388ba5bde921408fed107c53a` |
| `src/components/ConsentBanner.astro` | `b78fe3deedd6e591389baea6a7d1f94eb8a1aee0` |
| `src/components/BehaviorTracking.astro` | `066c1bc22da53c1423ddbe6ebbe8a8d9cfe5315e` |
| `src/lib/pricing.ts` | `bfb80c46a7a67324c88d0098077c7409efc2410d` |
| `src/lib/googleAds.ts` | `d66768bcf4b56fb3a901e6c39a114b374fadda33` |
| `src/styles/global.css` | `f8b650c8c4f96009c0ef32ab4d279cf0ddb9c5cb` |
| `astro.config.mjs` | `722787489cb9f6508bdddd521b113fe00feca084` |
| `package.json` | `35ac23ffdbab40d507049baeaa4c223bee233ba9` |
| `package-lock.json` | `bc1986a1fca57f48aaef48411c607207860737cb` |
| `vercel.json` | `b508d634947d1115aa94a1c01e3096b82a4e20d7` |
| `src/lib/track/**` | `70b201db6b7f2a5273dfbfc01c20522c1d758428` (arbre) |
| `src/pages/api/**` | `427d9cb0b0ba3cb4cbf9b092ae356a2e3659d572` (arbre) |
| `src/pages/admin/**` | `e05270026d673daa2157122ef6bb1c3becad0559` (arbre) |
| `src/pages/rdv/**` | `d9e52f44c349ffe7cfb21b1b516f711d1d71154f` (arbre) |
| `src/pages/devis/signer/**` | `d71d3f6a672068e85f5ecbf41c32c7b8080de473` (arbre) |
| `supabase/**` | `f142ffc21d3e659445a0b5ccd311e580459a39d0` (arbre) |

## Instances de formulaires et props (à conserver)

| Page / composant | Instances | Props |
|---|---|---|
| `/lp/vente-prix` (`LandingVente`, A) | 2 QuoteForm | `lockExperiments`, `forceCta="A"`, `forceSteps="A"`, `priceModelVariant=A`, `revealEstimation=true`, `defaultDemande="vente"`, `recallSla` |
| `/lp/vente-sans-prix` (`LandingVente`, B) | 2 QuoteForm | idem avec `priceModelVariant=B`, `revealEstimation=false` |
| `/lp/dpe` (`LandingDPE`) | 2 QuoteForm | `lockExperiments`, `forceCta="A"`, `forceSteps="A"`, `revealEstimation=false`, `defaultDemande="dpe"`, `recallSla` |
| 4 pages offres (`OfferTemplate`) | 2 QuoteForm | `revealEstimation={isPack}`, `defaultDemande={offer.demande}` |
| `/` | 1 QuoteForm + 1 CallbackForm (`#rappel`) | `revealEstimation=true` |
| `/tarifs` | 1 QuoteForm (`#simulateur`) | `revealEstimation=true` |
| `/devis` | 1 QuoteForm | aucune (préselection `?type=`) |
| `/contact` | 1 ContactForm | — |
| 8 fiches `/diagnostics/*` | 2 QuoteForm | `revealEstimation=true` |
| 33 pages locales | 2 QuoteForm | `revealEstimation=true` |
| Guide prix | 1 QuoteForm (`#simulateur`) | `revealEstimation=false` |
| `Base` (toutes pages publiques non LP) | ChatWidget | — |

## Mesures de référence (build de la baseline)

| Mesure | Résultat |
|---|---|
| Instantané HTML (`snapshot.mjs`) | 62 routes, sitemap 59 URL |
| Recette isolée des formulaires (`forms.e2e.mjs`) | 29 PASS · U02 NON EXÉCUTÉ |
| Contrôles DOM (`design-checks.mjs`, 21 routes × 390×844 / 1440×1000) | contraste < seuil : **54** · focus sans indicateur : **21** · boutons < 44 px : **91** · débordement : aucun · police de saisie min : 13,3 px |
| Captures « avant » | 390×844 et 1440×1000 (20 pages), 320 / 768 / 900 px (4 parcours sensibles) |

Anomalies relevées à la baseline (préexistantes au design) : texte blanc sur orange `#E2671F` (3,39:1) sur
tous les boutons principaux ; titre de l'intro sombre de `/diagnostics-location` bleu sur bleu (1:1, introduit
par le lot wording) ; champs du formulaire sans anneau de focus (seule la couleur de bordure change) ;
police de saisie < 16 px (zoom automatique iOS).

## Isolation de la recette

Navigateur Playwright, contexte instrumenté avant navigation : `/api/lead` simulé (partiels ET complets
enregistrés séparément), `/api/*` → 204, service geo.api.gouv.fr simulé, **toute autre requête bloquée et
journalisée** (cas EXT : aucune requête externe transmise), service workers bloqués pour les contrôles DOM.
Aucun lead, email, notification ni conversion ne quitte la machine. Builds de recette avec identifiants
Ads factices (`AW-TEST`).
