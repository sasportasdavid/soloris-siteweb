# Visuels landing pages — règles d'intégration (CONFORMITÉ)

Images générées (IA, Higgsfield `nano_banana_pro`). Photoréalistes, ambiance immobilier
parisien, sans texte/logo/watermark. **Versions WebP** (PNG sources ~1K non commités —
placeholders). ⚠️ **Demander une régénération 2K avant la mise en prod définitive.**

## ⚠️ Règles NON négociables
1. **Aucune image n'est une preuve.** Ces personnes sont des illustrations génériques —
   PAS des clients réels ni le diagnostiqueur réel de Soloris.
2. **Légendes interdites** : jamais « notre diagnostiqueur certifié COFRAC », ni un nom,
   ni « notre client ». Légendes neutres OK : « L'expertise sur place », « Un diagnostic
   mené avec méthode », « Paris & Île-de-France ».
3. **Ne jamais accoler ces visages aux avis Google.** Les avis gardent leurs avatars réels.
4. `alt` = description factuelle (voir ci-dessous), jamais une allégation.

## Technique
- Servir en WebP (déjà fait). `width`/`height` renseignés pour éviter le CLS.
- Hero : `loading="eager"` + `fetchpriority="high"`. Autres : `loading="lazy"`.
- Régénération 2K + `srcset` 1x/2x pour les assets définitifs.

## Inventaire (alt factuel imposé)
| fichier | dims | alt | placement prévu |
|---|---|---|---|
| hero-vente-a.webp | 1376×768 | Appartement parisien lumineux, propriétaire avec ses clés | hero LP vente A |
| hero-vente-b.webp | 1376×768 | Appartement parisien lumineux, propriétaire avec ses clés | hero LP vente B |
| remise-cles.webp | 1264×848 | Remise des clés d'un appartement | section closer / confiance |
| ambiance-tablette.webp | 1264×848 | Relevés réalisés sur tablette dans un appartement lumineux | section « comment ça marche » |
| facade-haussmann.webp | 1376×768 | Façade d'immeuble haussmannien parisien | section zone Paris & IDF |
| diag-camera-thermique | 1264×848 | Mesure à la caméra thermique près d'une fenêtre | section DPE/audit — ⚠️ **MANQUANTE** (URL CDN expirée, à re-télécharger) |
| diag-tableau-electrique.webp | 1264×848 | Inspection d'un tableau électrique | section électricité / inclus |
| diag-restitution-couple.webp | 1264×848 | Restitution des résultats sur tablette à des propriétaires | confiance / process étape 3 |
| diag-telemetre-laser.webp | 1200×896 | Mesure d'une pièce au télémètre laser | section mesurage / process |
| diag-mains-tablette-laser.webp | 1264×848 | Tablette et télémètre laser lors d'un diagnostic | bandeau / vignette |
