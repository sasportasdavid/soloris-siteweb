# Design UX V3 — rapport de remise (lot R)

Date : 15/10/2026. Branche `design/v3`, baseline figée `52ec190` (production du wording V2, `docs/design-soloris/BASE_SHA`).
Cahier : *Soloris — Cahier Design UX Complet* (V3) et `PROMPT_CLAUDE.md`. Le contrat de non-régression prime sur le design.

> Ce rapport ne déclare pas le site « 100 % fonctionnel ». Il liste les contrôles **réellement exécutés**, leurs
> résultats, et ce qui reste **NON EXÉCUTÉ**.

## 1. Ce qui a changé

Une **feuille additionnelle** `src/styles/soloris-design-v3.css`, activée par un attribut sur `<body>` dans les deux
layouts publics. Le back-office (`/admin`), les API, `/rdv/*` et `/devis/signer/*` ne la reçoivent pas
(ces deux dernières routes n'utilisent d'ailleurs ni `Base` ni `LandingLayout`).
Aucun framework, aucune bibliothèque, aucune police, aucun JavaScript ajoutés.

| Lot | Commit | Fichiers applicatifs | Contenu |
|---|---|---|---|
| 0 | `151d984` | — (outillage, docs) | Baseline, contrôleur de périmètre, contrôles DOM, isolation |
| V1 lisibilité / action | `d732b97` | `Base.astro`, `LandingLayout.astro` (3 lignes chacun), feuille V3 | Couleur d'action `#B84913` (blanc 5,25:1 au lieu de 3,39:1), cibles ≥ 44–48 px, anneau de focus, champs 16 px, hiérarchie des titres, cartes |
| V2 responsive | `ec08f37` | feuille V3 | Hero une colonne ≤ 920 px, rythme des sections, LP mobiles, petits écrans 320–380 px |
| P1 LP et offres | `74e826c` | `OfferTemplate.astro`, feuille V3 | Montant de départ visible dans le bloc prix (lu dans `pricing.ts`, identique au JSON-LD), conditions juste en dessous |
| P2 accueil / tarifs / confiance | `599ed41` | `tarifs.astro` + 10 pages (H1 : style inline → classe), feuille V3 | Résumé des trois repères de prix en tête de `/tarifs`, tableau défilant accessible (région nommée, focus) |
| P3 autres gabarits | `eee6b05` | feuille V3 | Guides, fiches diagnostics, pages locales, pages légales |
| R recette | ce commit | feuille V3 (3 règles), outillage, docs | Signature « Une marque d'IS DIAG » du header lisible, lien téléphone du pied de LP souligné |

Diff applicatif total depuis la baseline : feuille V3 (≈ 320 lignes), 2 layouts (3 lignes chacun),
`OfferTemplate.astro` (+7/−2), `tarifs.astro` (+21/−2), 10 pages (1 ligne chacune). Le reste est de l'outillage
(`scripts/controles/`) et de la documentation (`docs/design-soloris/`).

**Textes** : aucun texte éditorial modifié. Seul ajout visible : le résumé de `/tarifs` reprend les montants et
conditions déjà publiés (DPE dès 150 € TTC, packs dès 159 € TTC, audit de 450 à 900 € TTC) et le bloc prix des offres
affiche le montant déjà présent dans les données structurées.

## 2. Fichiers gelés : intégrité prouvée

Empreintes git identiques entre `52ec190` et la tête de branche :

| Fichier | Empreinte (base = tête) |
|---|---|
| `src/components/QuoteForm.astro` | `a54f6e258050` |
| `src/components/CallbackForm.astro` | `5f5e3d9d38f6` |
| `src/components/ContactForm.astro` | `0744856d2735` |
| `src/components/ChatWidget.astro` | `a8a958c71c9d` |
| `src/components/Analytics.astro` | `a80cd344c679` |
| `src/components/ConsentBanner.astro` | `b78fe3deedd6` |
| `src/components/BehaviorTracking.astro` | `066c1bc22da5` |
| `src/lib/pricing.ts` | `bfb80c46a7a6` |
| `src/styles/global.css` | `f8b650c8c4f9` |
| `astro.config.mjs`, `vercel.json`, `package.json`, `package-lock.json` | inchangés |

Aucun fichier modifié sous `src/pages/api`, `src/lib`, `src/pages/admin`, `supabase`, `.env*`.

## 3. Inventaire des props et instances

Identique à la baseline (comparaison des appels complets, props comprises) : 14 appels `QuoteForm`
(`revealEstimation={true}` ×6, `{false}` ×1, `{isPack}` + `defaultDemande` ×2, sans prop ×1, et 4 appels des LP dans `LandingVente.astro` / `LandingDPE.astro` — `lockExperiments`, `forceCta`, `forceSteps`… —, fichiers non modifiés), 1 `CallbackForm`,
1 `ContactForm`, 1 `ChatWidget`, 2 `ConsentBanner`, 2 `Analytics`, 2 `BehaviorTracking`.
LP Vente B toujours sans prix ; LP DPE et guide prix toujours `revealEstimation=false` ; préselections et expériences inchangées.

## 4. Résultats de recette (builds finaux)

Isolation : navigateur Playwright instrumenté avant navigation, `/api/lead` simulé (partiels **et** complets),
`/api/*` simulé, `geo.api.gouv.fr` simulé, **toute autre requête bloquée et journalisée** ; build de recette avec
identifiants Ads factices (`AW-TEST`). Lighthouse : résolution DNS externe désactivée, aucun proxy.
Aucun lead, email, notification ni conversion n'a quitté la machine.

| Contrôle | Outil | Résultat |
|---|---|---|
| Périmètre source (gelés, CSS interdit, layouts, invariants des pages) | `perimetre-design.mjs --lot pages` | **Accepté**, 0 blocage. 2 « À REVOIR » examinés : import `prixLabel` dans `OfferTemplate` (affichage seul) ; lien `/diagnostics-vente` ajouté dans le résumé `/tarifs` |
| Instantané HTML (62 routes) vs baseline | `snapshot.mjs` + `compare.mjs --mode=E` | **26 PASS, 0 ÉCHEC** : routes, canoniques, robots, sitemap (59), attributs de formulaires, ids/ancres, liens `tel:`, scripts, H1, prix JSON-LD visibles, bras B sans montant, liens internes |
| DOM rendu, 21 routes × 390/1440, variante A | `design-checks.mjs` | Visibilité de chaque élément de formulaire **identique** ; contraste < seuil **54 → 0** ; focus sans indicateur **21 → 0** ; boutons < 44 px **91 → 0** ; débordement : aucun |
| Idem, variante B | `design-checks.mjs` | Identique : 54 → 0, 21 → 0, 91 → 0, visibilité identique |
| 9 parcours sensibles × 320/768/900, A et B | `design-checks.mjs` | 45 → 0, 42 → 0, 90 → 0, visibilité identique, aucun débordement |
| Police des champs visibles | DOM | 15 → **16 px** (évite le zoom iOS) ; seul le pot de miel caché reste à 13,3 px (non touché) |
| Recette fonctionnelle des formulaires | `forms.e2e.mjs` | **29 PASS · 1 NON EXÉCUTÉ (U02 lecteur d'écran)** — identique à la baseline |
| États des formulaires avant/après (390 et 1440) | `etats-formulaires.mjs` | 44 captures par build : initial, choix, bien, adresse, coordonnées, erreur, focus, succès (prix révélé A), envoi lent, échec API, bras B, DPE, rappel, contact. Mêmes étapes, mêmes champs, même moment de révélation |
| Couverture des URL (`couverture-urls.csv`) | `couverture-design.mjs` | **62 URL publiques × 2 écrans : 124 PASS** (feuille active, 0 débordement, 0 erreur JS) ; 4 pages admin : attribut absent comme attendu |
| Parcours devis au clavier seul | `clavier-devis.mjs` | `/devis/` **PASS** (focus placé sur chaque nouvelle étape) ; `/dpe/`, `/lp/vente-prix/`, `/lp/dpe/` **ÉCHEC avant ET après** : option présélectionnée non validable au clavier (anomalie préexistante du composant gelé, ticket F3) |
| Espacement du texte (WCAG 1.4.12) | `espacement-texte.mjs` | 7 pages × 390/1440 : 0 débordement, 0 bouton ou titre coupé |
| Zoom / reflow | `design-checks.mjs` à 320 px | Aucun débordement horizontal (équivalent zoom 400 % sur 1280 px) |
| Procédure de retrait | copie séparée (`git worktree`) | Build OK ; instantané identique à la baseline (26 PASS) ; mesures DOM revenues exactement à 54 / 21 / 91 |
| Poids | build | CSS +12,3 Ko minifié, **+2,0 Ko compressé** (budget ≤ 12 Ko) ; JS identique (9 fichiers, 685 970 o) ; polices identiques (14) ; même nombre de feuilles et de scripts par page |

### Événements logiques observés (recette isolée, `dataLayer` et requêtes simulées)

| Parcours | Écritures `/api/lead` | Événements | Conversion (identifiants factices) |
|---|---|---|---|
| Devis DPE (`/lp/dpe/`) | 1 complet (`type_demande=dpe`, `estimation=150`, email vide accepté) | `lead_submitted` (`projet=dpe`, `prix_estime=150`, EUR) | 1 × libellé DPE, valeur 150, `transaction_id` = identifiant du lead ; aucune conversion Vente |
| Devis vente / location / audit | 1 complet chacun, type conservé | `lead_submitted` | 1 × libellé Vente, valeur = estimation (159 / 249 / 450), EUR |
| LP vente A | 1 complet, `price_model=A` | montant affiché **au succès** (moment historique) | 1 |
| LP vente B | 1 complet, `estimation=159` transmise, `price_model=B` | aucun montant visible | 1 |
| Deux instances sur une page | racines initialisées une fois chacune ; seule la 2e soumise | — | 1 |
| Double clic | 1 complet | — | 1 |
| Échec API (500, sans id, coupure) | — | message d'erreur, bouton réactivé | 0 |
| Rappel puis devis | partiel puis complet, **même `lead_uid`** | — | — |
| Abandon après coordonnées | 2 partiels avec téléphone, 0 complet | — | 0 |
| Clic téléphone | — | `soloris_phone_call` ×1 | 1 × libellé Appel |
| Contact | 1 complet `source=contact` | `soloris_contact` ×1 | 0 |
| Expériences | cookies `soloris_ab_cta/steps/early` posés | impressions dédupliquées (une fois par page) | — |
| Consentement | défaut `denied` (EEE), devis possible après refus | — | — |
| Attribution | `gclid`, UTM, `landing_path` conservés jusqu'au payload | — | — |

### Performance mesurée (laboratoire, Lighthouse 12.2.1, profil mobile simulé)

**a) Serveur local sans compression** (3 mesures par page et par build) :

| Page | Build | Perf. (méd.) | Access. | FCP | LCP | TBT | CLS | Poids total | CSS transféré |
|---|---|---|---|---|---|---|---|---|---|
| / | avant (3 mesures) | 90 | 95 | 2,86 s | 2,93 s | 0 ms | 0,000 | 506 Ko | 48,9 Ko |
| / | après (3 mesures) | 96 | 95 | 2,12 s | 2,27 s | 0 ms | 0,000 | 518 Ko | 60,9 Ko |
| /dpe | avant (3 mesures) | 97 | 95 | 2,11 s | 2,11 s | 0 ms | 0,000 | 395 Ko | 48,9 Ko |
| /dpe | après (3 mesures) | 92 | 95 | 2,71 s | 2,71 s | 0 ms | 0,000 | 407 Ko | 60,9 Ko |
| /lp/vente-prix | avant (3 mesures) | 92 | 92 | 2,41 s | 2,56 s | 0 ms | 0,019 | 311 Ko | 43,6 Ko |
| /lp/vente-prix | après (3 mesures) | 93 | 96 | 2,41 s | 2,71 s | 0 ms | 0,021 | 323 Ko | 55,6 Ko |
| /tarifs | avant (3 mesures) | 91 | 95 | 2,71 s | 2,86 s | 0 ms | 0,024 | 337 Ko | 48,9 Ko |
| /tarifs | après (3 mesures) | 93 | 98 | 2,41 s | 2,71 s | 0 ms | 0,000 | 350 Ko | 60,9 Ko |

**b) Serveur local avec compression gzip, comme en production** (5 tirs alternés avant/après) :

| Page | Build | Perf. (méd.) | FCP (méd.) | LCP (méd.) | LCP des 5 tirs | CSS transféré |
|---|---|---|---|---|---|---|
| /dpe | avant | 98 | 1,81 s | 1,96 s | 1,96 · 1,66 · 1,96 · 1,65 · 1,96 | 11,5 Ko |
| /dpe | après | 98 | 1,80 s | 1,95 s | 1,66 · 1,96 · 1,96 · 1,95 · 1,66 | 13,6 Ko |
| / | avant | 100 | 1,51 s | 1,51 s | 1,51 · 1,80 · 1,50 · 1,51 · 1,50 | 11,5 Ko |
| / | après | 99 | 1,66 s | 1,80 s | 1,51 · 2,33 · 2,33 · 1,50 · 1,80 | 13,6 Ko |

Élément LCP (mobile, mesuré par `PerformanceObserver`) : le **H1** sur `/` et `/dpe`, avant comme après, rendu au même
instant sans bridage. Aucune requête externe pendant les mesures.

Lecture : mesures de **laboratoire** (bridage simulé), à forte variabilité d'un tir à l'autre. Sans compression,
le CSS ajouté pèse 12 Ko de plus sur le chemin critique ; avec compression, +2,1 Ko. Sur `/dpe` les médianes compressées
sont identiques ; sur `/` la médiane LCP passe de 1,51 à 1,80 s, deux tirs sur cinq à 2,33 s, sans changement d'élément
LCP : l'écart reste dans la dispersion observée, mais **un léger coût de rendu ne peut pas être exclu**. Aucun gain n'est
revendiqué. Les Core Web Vitals de terrain (LCP, INP, CLS au 75e percentile) sont **NON EXÉCUTÉS** : à suivre après
mise en ligne (rapport Chrome UX / mesures Vercel si activées).

Audits Lighthouse d'accessibilité encore signalés après V3 (tous **préexistants**) : bouton « Accepter » du bandeau
de consentement (blanc sur `#E2671F`, 3,39:1 — composant gelé, non modifié pour ne pas toucher à l'équilibre
accepter/refuser) ; ordre des titres du pied de page (`h2` → `h4`, balisage de `Footer.astro`).

## 5. Les 51 scénarios du cahier

Le fichier des 51 scénarios (CSV) et le contrôleur Python cités par le cahier **n'étaient pas dans le dossier fourni**
(voir `BASELINE.md`). Ils sont donc **NON EXÉCUTÉS en tant que tels**. Les thèmes que le prompt impose de tester sont
couverts par les contrôles ci-dessus :

| Thème du prompt | Test exécuté | Résultat |
|---|---|---|
| Deux instances | F03 | PASS |
| Double clic | F04 | PASS |
| Erreurs API | F05 ×3, C02 | PASS |
| Partiels / complets | F14, F15 | PASS |
| Seuils de prix | F10, F09, F06 | PASS |
| Attribution | T01 | PASS (gbraid/wbraid : écart documenté, ticket T1) |
| Variantes | F08a, F08b, T04, T05 + contrôles DOM A et B | PASS |
| Consentement | T02 | PASS (défaut `denied`) |
| Téléphone | T03 | PASS |
| Clavier | indicateur de focus (DOM) ; parcours clavier seul | focus PASS ; parcours **ÉCHEC préexistant** sur 3 pages / 4 |
| Zoom / petits écrans | 320 / 768 / 900 px, espacement du texte | PASS |
| Lecteur d'écran | — | **NON EXÉCUTÉ** |

## 6. Anomalies préexistantes (non introduites par V3)

- Parcours devis au clavier : blocage à l'étape 1 quand une option est présélectionnée (Espace / Entrée sans effet,
  « Continuer » masqué ; seule une flèche avance, en changeant le projet) — F3.
- Erreurs de saisie signalées par la seule couleur de bordure, sans message relié au champ (F3).
- Bouton « Accepter » du bandeau de consentement à 3,39:1 (composant gelé).
- `gbraid` / `wbraid` capturés mais non transmis avec le lead (T1).
- Barre mobile des LP vers l'instance basse (`#simulateur`) même si l'instance haute est commencée (F1).
- Baseline : titre de l'intro sombre de `/diagnostics-location` bleu sur bleu (1:1) — **corrigé** par V3.

## 7. Limites de validation

- **GTM / Google Ads** : le conteneur GTM et les déclencheurs publiés ne sont pas accessibles depuis le dépôt. La recette
  observe les événements logiques dans `dataLayer` avec des identifiants factices ; elle ne prouve pas la réception
  par Google ni le comportement des balises distantes. V3 ne modifie ni texte, ni classe, ni attribut de cible suivie
  (contrôle `compare.mjs`), mais un déclencheur basé sur un sélecteur CSS de style reste théoriquement possible.
- **NON EXÉCUTÉ** : lecteur d'écran (U02) ; navigateurs autres que Chromium (Safari iOS, Firefox) ; appareils réels ;
  données de terrain (Core Web Vitals, INP) ; mode sombre ou contraste forcé du système.
- Les routes rendues côté serveur (`/rdv/*`, `/devis/signer/*`) ne sont pas testées en navigateur : elles n'importent
  pas les layouts publics (vérifié dans le code).

## 8. Procédure de retrait

1. **Désactivation immédiate** : dans `src/layouts/Base.astro` et `src/layouts/LandingLayout.astro`, supprimer
   l'import `soloris-design-v3.css`, la constante `solorisDesignV3` et remettre `<body>` ; supprimer la feuille.
   Testé : build OK, HTML identique à la baseline (hors attribut), mesures DOM revenues à 54 / 21 / 91.
   Les classes `v3-*` restent alors sans style (le résumé de `/tarifs` s'affiche en liste simple).
2. **Retour complet** : `git revert` des commits du lot (PR fusionnée) — ne jamais revenir à un ancien commit par
   réinitialisation de branche.

## 9. Reproduire

```sh
# builds : production + recette (identifiants Ads factices)
npx astro build && cp -r .vercel/output/static /tmp/static
PUBLIC_GADS_ID=AW-TEST PUBLIC_GADS_CONVERSION_LABEL=FORMTEST PUBLIC_GADS_PHONE_LABEL=PHONETEST npx astro build && cp -r .vercel/output/static /tmp/static-test
node scripts/controles/perimetre-design.mjs --base $(cat docs/design-soloris/BASE_SHA) --lot pages
AB_VARIANT=A node scripts/controles/design-checks.mjs /tmp/static /tmp/dc-A.json
node scripts/controles/forms.e2e.mjs /tmp/static-test /tmp/e2e.json
node scripts/controles/etats-formulaires.mjs /tmp/static-test /tmp/etats
node scripts/controles/couverture-design.mjs /tmp/static /tmp/couverture.csv
node scripts/controles/clavier-devis.mjs /tmp/static-test /devis/
node scripts/controles/espacement-texte.mjs /tmp/static
```

Les captures avant/après (pages et états de formulaires, mobile 390 px et ordinateur 1440 px) sont produites par
`captures.mjs` et `etats-formulaires.mjs` sur les deux builds ; elles sont remises avec ce rapport, pas versionnées.

Tickets séparés (non appliqués) : `TICKETS.md`.
