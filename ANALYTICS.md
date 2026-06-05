# Analytics comportemental first-party — Soloris

Mesure **quantitative** (sessions, parcours, scroll, clics, funnel `/devis` au champ)
et **qualitative** (session replay rrweb, heatmaps), **100 % first-party** : toute la
donnée vit dans le projet Supabase `apfwoowmdxmyomprkmci`. **Aucune donnée envoyée à un
tiers.** Conçu pour rester conforme RGPD/CNIL et pour éclairer en priorité le problème
**« le trafic payant atteint `/devis`, joue avec l'estimateur, puis abandonne avant de
laisser ses coordonnées »**.

---

## 1. Architecture

```
Navigateur (consentement « Analyse de navigation » requis)
  └─ src/lib/track/tracker.ts  (3.8 KB gz, chargé via BehaviorTracking.astro)
       ├─ quanti : page_view, scroll, click, rage_click, funnel /devis au champ
       └─ rrweb  (chunk séparé ~82 KB gz, chargé seulement si consenti, maskAllInputs)
            │  batch sendBeacon / fetch keepalive
            ▼
  POST /api/track  (Astro server route, Vercel)
       ├─ géo GROSSIÈRE via en-têtes Vercel (x-vercel-ip-city / -country-region) → IP JETÉE
       ├─ UA → hash tronqué (jamais l'UA brut)
       ├─ rate-limit, CORS limité au domaine
       └─ RPC public.ingest_analytics(payload jsonb)  [SECURITY DEFINER]
            ▼
  Supabase (eu-west-1)
       analytics_sessions / analytics_events / analytics_replay_chunks / analytics_heatmap_daily
       vues v_*  →  /admin/analytics  (Supabase Auth, RLS authenticated)
       pg_cron : refresh_heatmap_daily (3h15) · purge_analytics_retention (3h30)
```

Le choix d'une **route Astro `/api/track`** (plutôt qu'une Edge Function Supabase) suit le
modèle déjà en place (`/api/lead` → `upsert_lead`) **et** permet la géo grossière
gratuitement via les en-têtes Vercel — sans aucun service de géolocalisation tiers.

## 2. Modèle de données (migration `20260604_0001_analytics_core`)

| Table | Rôle |
|---|---|
| `analytics_sessions` | 1 ligne / session (30 min d'inactivité). Attribution UTM/gclid, device, géo grossière, `consent_state`, `lead_id`, `ua_hash`. |
| `analytics_events` | events horodatés (enum `type`), `path`, `element` (sélecteur/texte tronqué — **jamais de valeur de champ**), `meta jsonb`. |
| `analytics_replay_chunks` | batches rrweb (`events jsonb`, compression TOAST), `masked bool`. Rétention **30 j**. |
| `analytics_heatmap_daily` | **agrégat** clics (grille 50×200) + histogramme scroll, par page/device. |
| `leads.session_id`, `leads.visitor_id` | lien lead ↔ comportement (additif, rien retiré). |

**Pourquoi une table d'agrégat et non une vue matérialisée pour les heatmaps ?** L'agrégat
quotidien (`refresh_heatmap_daily`) survit à la **purge des events bruts à 13 mois** (une
matview serait vidée avec sa source) et évite de recalculer tout l'historique à chaque refresh.

## 3. Sécurité

- **RLS activée** sur les 4 tables : **aucune policy `anon`** → ni lecture ni écriture directe.
  Lecture `SELECT` réservée au rôle `authenticated` (dashboard admin). Vues `v_*` en
  `security_invoker = true`, `GRANT SELECT … TO authenticated` uniquement.
- **Écriture uniquement via `ingest_analytics` (SECURITY DEFINER)** : la clé `anon` ne peut
  qu'appeler cette fonction validée (taille de lot bornée, types en liste blanche via le
  CHECK). C'est exactement le modèle de `upsert_lead`/`sign_devis` déjà en production.
  > L'advisor Supabase signale « SECURITY DEFINER exécutable par anon » sur
  > `ingest_analytics`/`purge_visitor_analytics` : **c'est voulu et identique aux RPC
  > existantes** — la surface exposée est volontairement réduite à ces fonctions.
- **Secrets** : aucun nouveau secret. `/api/track` réutilise `PUBLIC_SUPABASE_URL` /
  `PUBLIC_SUPABASE_ANON_KEY` (déjà présents). Jamais committés.

## 4. Conformité RGPD / CNIL

### Deux modes de mesure

1. **Mesure d'audience anonyme — SANS consentement (exemption CNIL).** Active par défaut
   pour 100 % des visiteurs. First-party, aucune donnée tierce, **IP jetée** côté serveur,
   **aucun cookie/identifiant persistant** (id de session en `sessionStorage`, effacé à la
   fermeture de l'onglet, pas de lien inter-sessions), **pas de hash d'UA stocké**
   (`ua_hash = null`). Données limitées : pages vues, temps par page, profondeur de scroll,
   **étapes du funnel `/devis`**. Marquées `consent_state = 'exempt'`.
   → Pas de coordonnées de clic (heatmap), pas de suivi champ par champ, **pas de replay**.
2. **Analyse détaillée — APRÈS consentement** (`behavior`). Ajoute clics + coordonnées
   (heatmaps), rage-clicks, funnel au champ (dernier champ avant abandon), **session replay
   rrweb**, et un `visitor_id` persistant (lien lead ↔ comportement). Retrait = purge + retour
   en mode anonyme.

Base de l'exemption CNIL : mesure d'audience strictement first-party, finalité limitée aux
statistiques internes, pas de recoupement entre sites, pas de partage tiers, IP anonymisée,
pas d'identifiant persistant ré-identifiant. (Lignes 1 = exempt ; lignes 2 = consentement.)

| Exigence | Mise en œuvre |
|---|---|
| **Consentement** | Catégorie dédiée **« Analyse de navigation »** (`behavior`) dans le bandeau, opt-in, distincte de « Mesure d'audience » (GA4) et « Publicité ». La mesure **anonyme** tourne sans consentement (exemption) ; **replay/heatmaps/champ par champ/visitor_id persistant** exigent `behavior`. |
| **Base légale** | Consentement (art. 6.1.a RGPD). Le session replay étant intrusif, il a sa propre case et son propre retrait. |
| **Anonymisation IP** | L'IP n'est **jamais** stockée : `/api/track` dérive une géo grossière (région/ville) des en-têtes Vercel puis jette l'IP. `ua_hash` = SHA-256 tronqué, pas l'UA brut. |
| **Aucune PII** | rrweb `maskAllInputs:true` + `maskInputOptions {password,email,tel,text}` + classe `.pii` bloquée/masquée. Les events ne portent que des **métadonnées de champ** (`field_name`, `filled`, `len`) — **jamais** `telephone/email/nom/adresse`. |
| **Rétention** | `pg_cron` quotidien : events + sessions ≤ **13 mois**, replays ≤ **30 jours**, heatmaps agrégées conservées. |
| **Retrait / refus** | Décocher « Analyse de navigation » (ou « Tout refuser ») → arrêt immédiat **et purge** de la session courante : `purge_visitor_analytics(visitor_id)` (cascade events + replay). |

## 5. Les 6 questions métier → SQL

```sql
-- 1 & 2. Funnel /devis par étape + dernier champ avant abandon (filtrable canal)
select * from v_devis_funnel;           -- visites → vue → champ → estimation → coordonnées → soumission
select * from v_devis_dropoff_fields;   -- dernier champ touché avant form_abandon (ex. « telephone »)

-- 3. Payant vs organique (durée, pages/session, rebond, leads)
select * from v_paid_vs_organic;

-- Parcours / pages
select * from v_top_pages;              -- vues, temps moyen, scroll moyen
select * from v_entry_exit_pages;       -- pages d'entrée / de sortie

-- 4. Qualité géo — hors zone Paris(75)+93
select * from v_leads_hors_zone;        -- leads dont le CP n'est ni 75 ni 93
select * from v_sessions_hors_idf;      -- sessions hors Île-de-France (géo grossière)

-- 6. Engagement & friction
select * from v_sessions_daily;         -- sessions/jour, visiteurs, pages/session, rebond, part payant
select * from v_rage_clicks;            -- rage-clicks par page

-- Parcours d'une session précise (ordre des pages/events)
select ts, type, path, meta from analytics_events where session_id = '<uuid>' order by ts;
```

Helper : `is_paid(gclid, medium)` → `true` si `gclid` présent ou `medium ∈ {cpc,ppc,paid,…}`.

## 6. Dashboard `/admin/analytics`

Protégé par Supabase Auth. Sections : KPIs, sessions/jour, **funnel `/devis`** (taux par
étape + dernier champ avant abandon), payant vs organique, top pages, entrées/sorties,
**hors zone Paris+93** (marqué ⚠︎/rouge), rage-clicks, **heatmaps** (clics + profondeur de
scroll, par page/device, rendu canvas local) et **session replays** (rrweb-player).
Un **filtre « Trafic payant uniquement »** (gclid / `medium=cpc`) recalcule toutes les
sections — c'est l'usage prioritaire pour piloter les campagnes.

## 7. Branchement futur : conversions hors-ligne GCLID

Chaque lead porte désormais `gclid` (déjà) **+ `session_id` + `visitor_id`**. Pour importer
les conversions hors-ligne dans Google Ads (lead → RDV → facturé), il suffira de joindre :

```sql
select l.gclid, l.statut, l.montant, l.rdv_date, l.created_at, s.geo_city
from leads l left join analytics_sessions s on s.id = l.session_id
where l.gclid is not null and l.statut in ('rdv_pris','realise','facture');
```

→ aucune refonte nécessaire, le lien comportement ↔ acquisition est déjà en base.

## 8. Migrations & rollback

| Migration | Up | Down |
|---|---|---|
| `analytics_core` | `supabase/migrations/20260604_0001_analytics_core.sql` | `supabase/rollback/20260604_0001_analytics_core.down.sql` |
| `analytics_views_cron` | `supabase/migrations/20260604_0002_analytics_views_cron.sql` | `supabase/rollback/20260604_0002_analytics_views_cron.down.sql` |

Les deux migrations sont **purement additives** (aucune donnée existante modifiée) et
réversibles. `upsert_lead` est étendu (ajout `session_id`/`visitor_id`) ; le rollback
restaure sa version d'origine.

## 9. Vérification (faite en prod, données de test purgées)

- Funnel payant simulé : visite→vue→champ→estimation→coordonnées = 1, **soumission = 0**,
  **dernier champ avant abandon = `telephone`** (le problème métier, capturé).
- **0 valeur de champ** dans `analytics_events` ; chunk replay `masked=true`, input = `••••••••`.
- Heatmap (clics + scroll) agrégée ; jobs `pg_cron` actifs ; purge consentement → cascade OK.
