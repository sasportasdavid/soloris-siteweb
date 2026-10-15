# Contrôles de présentation, SEO et non-régression

Outillage ajouté pour le chantier éditorial V2 (dossier d'audit du 15 octobre 2026, commit audité
`538233ea7b3308ba20880e7173ce8f6d95ad5f98`). Aucune dépendance npm ajoutée : Playwright est utilisé
depuis l'installation globale (`PLAYWRIGHT_MODULE` pour en indiquer une autre).

| Script | Rôle |
|---|---|
| `scripts/controles/snapshot.mjs` | Instantané du build statique, JavaScript désactivé : title, description, robots, canonique, H1/H2, JSON-LD, montants visibles, liens, **signature des formulaires** (attributs de chaque élément) et **empreinte de chaque script**, sitemap, robots.txt. |
| `scripts/controles/compare.mjs` | Comparaison avant/après + fichiers protégés (git). Mode `E` (éditorial) : tout changement d'attribut de formulaire, de script ou de fichier protégé est un ÉCHEC. Mode `M` (microcopie de formulaire) : attributs toujours figés, scripts listés « À REVOIR ». Vérifie aussi : prix balisés visibles, allégations interdites (« certifié COFRAC », « milliers », « prix exact »…), 24 h absent de l'audit, aucun montant sur le bras B, liens internes, noindex des LP, sitemap. |
| `scripts/controles/captures.mjs` | Captures pleine page (JavaScript actif, requêtes externes bloquées, bandeau refusé) aux largeurs demandées + détection des débordements horizontaux. |
| `scripts/controles/forms.e2e.mjs` | Recette navigateur **isolée** des formulaires (matrice F01–F15, T01–T05, U01, C01–C02 contact). `/api/lead` et `/api/track` sont simulés, toute requête externe est bloquée : aucun lead, aucune notification, aucune conversion ne quitte la machine. Les conversions sont lues dans `window.dataLayer`. |

## Procédure

```bash
# 1. Build « public » (sans identifiants) → instantané
npx astro build && cp -r .vercel/output/static /tmp/static-apres
node scripts/controles/snapshot.mjs /tmp/snap-apres.json /tmp/static-apres
node scripts/controles/compare.mjs /tmp/snap-avant.json /tmp/snap-apres.json --mode=E --out=/tmp/compare.md

# 2. Build de recette avec identifiants Ads FACTICES (jamais déployé) → recette navigateur
PUBLIC_GADS_ID=AW-TEST PUBLIC_GADS_CONVERSION_LABEL=FORMTEST PUBLIC_GADS_PHONE_LABEL=PHONETEST \
  npx astro build && cp -r .vercel/output/static /tmp/static-test
node scripts/controles/forms.e2e.mjs /tmp/static-test /tmp/e2e.json
```

Un cas non couvert est rendu **NON EXÉCUTÉ**, jamais supposé réussi. Ces contrôles ne remplacent
ni une revue humaine, ni une vérification de la configuration GTM / Google Ads, ni un test sur appareil réel.

Les résultats de chaque lot sont consignés dans [`RAPPORT.md`](./RAPPORT.md).
