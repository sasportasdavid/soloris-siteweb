# Soloris — site diagnostics immobiliers

Site marketing + back-office CRM pour **Soloris**, diagnostics immobiliers à **Paris et en Île-de-France**.
Baseline : _« Le diagnostic, en toute clarté. »_

- **Stack** : Astro 5 (rendu statique + endpoints serverless), CSS tokenisé (pas de Tailwind), Supabase (leads + Auth), déploiement Vercel.
- **Design** : 100 % fidèle à l'identité visuelle (`Identité Soloris.html`). Tokens, composants, logo, favicon repris à l'identique. Ratio 60/30/10 (blanc/bleu/or).
- **Polices** : Sora, Inter, Fraunces — **auto-hébergées** en woff2 via `@fontsource` (aucun CDN Google Fonts, RGPD + perf).

---

## 1. Démarrage

```bash
npm install
cp .env.example .env   # puis renseigner les valeurs
npm run dev            # http://localhost:4321
npm run build          # build de production (sortie Vercel)
npm run preview        # prévisualisation locale
```

Node 20+ requis.

---

## 2. Variables d'environnement

Renseigner dans `.env` (local) **et** dans les _Environment Variables_ du projet Vercel.

| Variable | Rôle | Public ? |
|---|---|---|
| `SITE_URL` | Domaine canonique (SEO, JSON-LD, OG, sitemap) | — |
| `PUBLIC_SUPABASE_URL` | URL du projet Supabase | ✅ exposée |
| `PUBLIC_SUPABASE_ANON_KEY` | Clé publishable Supabase (insert public + Auth) | ✅ exposée |
| `SUPABASE_SERVICE_ROLE` | **Secret.** Clé service_role (optionnelle ; sinon l'insert passe par la clé anon via RLS) | 🔒 serveur |
| `PUBLIC_GA4_ID` | ID Google Analytics 4 (`G-XXXX`) | ✅ |
| `PUBLIC_GADS_ID` | ID Google Ads (`AW-XXXX`) | ✅ |
| `PUBLIC_GADS_CONVERSION_LABEL` | Libellé de conversion Google Ads | ✅ |
| `PUBLIC_META_PIXEL_ID` | ID Meta Pixel | ✅ |

> Tant que les IDs de tracking valent `__A_REMPLACER__`, **aucune balise n'est chargée** (pratique en dev). Le Consent Mode v2 reste en place.
> La clé `service_role` n'est **jamais** exposée au client : elle n'est lue que par l'endpoint serveur `/api/lead`.

Valeurs déjà connues (projet `soloris-site`) :

```
PUBLIC_SUPABASE_URL=https://apfwoowmdxmyomprkmci.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_awjilY-beDJX2h4GDQwOhw_LK41wTEN
```

---

## 3. Supabase (déjà provisionné)

La base est déjà configurée sur le projet `soloris-site` :

- **Table `leads`** créée (migration `create_leads_table`) avec index et **RLS** :
  - `insert_public` : insertion publique (formulaire) ;
  - `admin_select` / `admin_update` / `admin_delete` : lecture/écriture réservées à l'utilisateur authentifié.
- **Compte admin** créé pour le back-office :
  - **Email** : `admin@soloris.fr`
  - **Mot de passe** : communiqué séparément (hors dépôt public). ⚠️ **À CHANGER après la première connexion** (Dashboard Supabase > Authentication > Users, ou via « mot de passe oublié »).

Pour recréer la table ailleurs, le SQL est dans le brief (section 6).

---

## 4. Pages

| URL | Rôle |
|---|---|
| `/` | Accueil — hub + conversion (hero dynamique) |
| `/diagnostics-vente` `/diagnostics-location` `/dpe` `/audit-energetique` | Pages offres |
| `/tarifs` | Tarifs tout compris |
| `/methode` | Méthode & certification (E-E-A-T) |
| `/devis` | Formulaire multi-étapes + estimation |
| `/guides` + 3 articles | SEO de fond |
| `/mentions-legales` `/confidentialite` | RGPD |
| `/admin` `/admin/login` | Back-office CRM (protégé) |
| `/api/lead` | Endpoint serveur d'insertion des leads |

---

## 5. Tracking & conformité

- **Consent Mode v2** : tout en `denied` par défaut. Bandeau CNIL : refuser aussi simple qu'accepter, choix granulaire (audience / publicité), rien de pré-coché, réouverture via le bouton flottant « gérer les cookies ».
- **Meta Pixel** : chargé **uniquement** après consentement publicité.
- **Attribution** : `utm_*`, `gclid`, `fbclid` capturés → `sessionStorage` → champs cachés du formulaire → colonne `leads`. Permet l'import de conversions hors-ligne (lead facturé → Google Ads via `gclid`).
- **Landing dynamique** : `?kw=` ou `utm_term` mappé à une **liste blanche** de variantes de hero (`src/lib/heroVariants.ts`). Jamais d'injection brute (anti-XSS). Fallback = hero par défaut.

---

## 6. ✅ Checklist de mise en ligne

### A. Contenu à renseigner — `[À REMPLACER]`

**`src/lib/site.ts`** (source NAP unique — cohérence SEO local) :
- [ ] Raison sociale / SIREN (`legalName`)
- [ ] Téléphone (`phone`, `phoneDisplay`) — actuellement `01 23 45 67 89`
- [ ] Email (`email`)
- [ ] Adresse du siège (`address.street`, `postalCode`, `city`)
- [ ] Coordonnées GPS (`geo.latitude/longitude`)
- [ ] Note & nombre d'avis Google (`rating.value`, `rating.count`) — **mettre `count` à un nombre réel** active automatiquement l'`AggregateRating` (JSON-LD) et la note dans la barre de réassurance
- [ ] Profils `sameAs` (fiche Google Business, LinkedIn…)
- [ ] N° de certification COFRAC (n'apparaît que s'il est réel)

**Avis clients** (`src/pages/index.astro`) :
- [ ] Remplacer les 3 avis exemples par des avis réels

**Pages légales** :
- [ ] `mentions-legales.astro` : éditeur, SIRET, TVA, directeur de publication, assureur RC Pro, n° COFRAC
- [ ] `confidentialite.astro` : durées de conservation, coordonnées DPO le cas échéant

**Tracking** (`.env`) :
- [ ] `PUBLIC_GA4_ID`, `PUBLIC_GADS_ID`, `PUBLIC_GADS_CONVERSION_LABEL`, `PUBLIC_META_PIXEL_ID`

### B. Conformité réglementaire — ✅ vérifiée (juin 2026)

Les affirmations réglementaires datées ont été **vérifiées auprès des sources officielles** (service-public.fr, economie.gouv.fr, ecologie.gouv.fr, ADEME) et intégrées sans marqueur. État retenu :
- DPE valable **10 ans** ; DPE d'avant le 1ᵉʳ juillet 2021 invalides depuis le 1ᵉʳ janvier 2025.
- Réforme du calcul DPE au **1ᵉʳ janvier 2026** (coefficient électricité 2,3 → 1,9, arrêté du 13 août 2025).
- Interdiction de location : **G** depuis 2025, **F** en 2028, **E** en 2034 (métropole).
- Audit énergétique à la vente (monopropriété) : **F/G** depuis 2023, **E** depuis 2025, **D** en 2034 ; validité 5 ans.
- Seuils diagnostics : amiante (permis < 1ᵉʳ juillet 1997), plomb (< 1949), élec/gaz (> 15 ans).

> ⚠️ La réglementation évolue : revérifier ces dates lors de mises à jour ultérieures du site. Source à jour en juin 2026.

### C. Garde-fous déontologiques (déjà respectés — à préserver)
- [ ] Aucune promesse de résultat de DPE (étiquettes toujours « exemple »)
- [ ] Aucun n° COFRAC inventé
- [ ] Prix « dès » honnêtes et atteignables
- [ ] Aucun terme interdit (« pas cher », « promo »…) dans les variantes de hero

### D. Technique
- [ ] `npm run build` OK (testé)
- [ ] Variables d'env configurées sur Vercel
- [ ] Domaine + SSL configurés ; `SITE_URL` et `robots.txt`/sitemap pointant vers le bon domaine
- [ ] Changer le mot de passe admin Supabase
- [ ] Vérifier la conversion Google Ads (soumission formulaire) en environnement réel

---

## 7. Architecture

```
src/
  components/   Logo, Header, Footer, Hero, OfferCard, OfferTemplate,
                PricingTable, Faq, QuoteForm, ReportPreview, EnergyScale,
                ReassuranceBar, Seo, Analytics, ConsentBanner
  layouts/      Base (site public), AdminLayout (back-office)
  lib/          site (NAP), pricing (grille), offers, guides,
                heroVariants (DTR), jsonld, supabase (client navigateur)
  pages/        toutes les pages + api/lead.ts
  styles/       global.css (tokens + composants de l'identité)
public/         favicon (SVG + PNG 16/32/180), icônes PWA, og-default.png,
                robots.txt, site.webmanifest
```

Le sitemap (`/sitemap-index.xml`) est généré automatiquement par `@astrojs/sitemap` (le back-office en est exclu).
