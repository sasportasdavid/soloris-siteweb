# Rapport — application du dossier éditorial V2 (15 octobre 2026)

Branche : `refonte/wording-v2` · Base : `538233ea7b3308ba20880e7173ce8f6d95ad5f98` (commit audité).
Au démarrage, `HEAD` de `main` était **identique** au commit audité : aucune évolution plus récente
à préserver, aucun retour arrière effectué. Aucun déploiement en production, aucune modification
de campagne, de conteneur GTM, de conversion ou de service distant.

## Lots et commits

| Lot | Commit | Contenu |
|---|---|---|
| 0 | `5fbe385` | Outils de contrôle (instantané, comparaison, recette isolée des formulaires) et état de référence |
| 1 | `b4119a8` | LP DPE et vente A/B, gabarit et données des 4 pages offres, `preuves.ts`, `wording.ts` |
| 2 | `b4befa1` | Accueil, tarifs, méthode, devis, contact, zones, hubs, mentions/confidentialité (titres et intro), composants globaux |
| 4 | `6d99763` | 8 fiches diagnostics, 4 guides, sources officielles |
| 5 | `6957f0d` | 33 pages locales (gabarit + données) |
| — | `1a6c55b` | Rappel « sous 30 min » : formulation « engagement validé » du dossier sur LP et accueil |
| 3 (M) | `dc85abf` | Microcopie des formulaires (chaînes seules), recette C01/C02 ajoutée |

## Vérifications exécutées

| Vérification | Résultat |
|---|---|
| `compare.mjs` final (mode M, référence → final, 62 routes) | **0 ÉCHEC**, 26 PASS, 3 À REVOIR (ci-dessous) |
| Routes, codes 200, canoniques, robots, `noindex` des LP, sitemap (59 URL), robots.txt | PASS — identiques à la référence |
| Formulaires : éléments, noms, valeurs, `required`, `data-*`, identifiants, classes | PASS — signatures identiques sur toutes les pages |
| Identifiants / ancres (`#simulateur`, `#rappel`, `#tarifs`…) | PASS — aucun supprimé |
| Liens `tel:` existants | PASS — tous conservés ; 8 ajoutés (À REVOIR, voir points) |
| Scripts | À REVOIR — seules 5 chaînes de texte changent (diff exact ci-dessous) + données `VARIANTS` du hero dynamique |
| Fichiers protégés (`pricing.ts`, tracking, consentement, API, admin, config) | PASS — inchangés ; `site.ts` : seule `cofracNote` change |
| Prix balisés en JSON-LD visibles dans la page | PASS |
| Allégations interdites (« certifié COFRAC », « milliers », « prix exact », brouillon, superlatifs, garantie de délai) | PASS sur les 62 pages |
| Audit énergétique sans délai 24 h hérité | PASS |
| Bras B `/lp/vente-sans-prix` sans montant (texte, title, meta, JSON-LD, alt) | PASS |
| Liens internes | PASS |
| Recette navigateur isolée (`forms.e2e.mjs`, API simulée, réseau externe bloqué) | **29 PASS** (F01–F15, T01–T05, U01, C01, C02) · **U02 NON EXÉCUTÉ** |
| Recette C01/C02 sur la référence | PASS (non-régression du formulaire de contact) |
| Captures 360 / 390 / 768 / 1440 px (14 pages, 56 captures) | Aucun débordement horizontal ; revue visuelle des premiers écrans |
| Points réglementaires du guide DPE (1,9 en 2026 ; arrêté du 19 août 2026 → 1,7 au 1er janvier 2027 ; attestations ; petites surfaces ; validité) | Recoupés sur service-public.gouv.fr (F16096) le 15/10/2026 |
| Règles des fiches (termites 6 mois, amiante 1997/2013, électricité 3/6 ans, état des risques 6 mois) | Recoupées sur service-public.gouv.fr le 15/10/2026 |

### Diff exact des scripts (lot M)

| Script | Avant | Après |
|---|---|---|
| QuoteForm, sous-titre étape 3 | Indiquez la surface et l'âge du bien : les diagnostics obligatoires varient selon l'année de construction. | Indiquez la surface et l'âge du bien. Cette information sert à estimer le pack ; les diagnostics nécessaires sont vérifiés selon les critères propres à votre bien. |
| QuoteForm, estimation au succès (mode true) | Votre estimation : à partir de X tout compris, déplacement inclus. Devis exact confirmé lors du rappel. | Votre estimation indicative : à partir de X. Déplacement inclus. Le devis exact est confirmé avant l’intervention. |
| QuoteForm, succès (mode false) | Votre devis personnalisé vous est confirmé lors du rappel, tout compris et sans engagement. | Nous confirmons votre tarif lors de notre échange, avant la visite. Déplacement inclus, demande sans engagement. |
| QuoteForm, erreur | Une erreur est survenue. Réessayez ou appelez-nous directement. | Votre demande n’a pas pu être confirmée. Réessayez ou appelez-nous. |
| CallbackForm, erreur | idem | Votre demande n’a pas pu être confirmée. Réessayez ou appelez-nous. |
| ContactForm, erreur | idem | Votre message n’a pas pu être envoyé. Réessayez ou appelez-nous. |

Le script de CallbackForm est minifié au build : en plus de la chaîne, le minificateur renomme des
variables locales (sans effet). Le bouton « Obtenir mon devis » est inchangé.

## Non exécuté

| Élément | Statut |
|---|---|
| U02 — lecteur d’écran et parcours clavier complet | NON EXÉCUTÉ (manuel) |
| Test sur appareils réels (iOS/Android) | NON EXÉCUTÉ |
| Prévisualisation Vercel de la branche : contrôle visuel en ligne | NON EXÉCUTÉ dans ce rapport — aucun formulaire ne doit y être soumis (la prévisualisation peut partager les clés de production) |
| Contrôle de la configuration GTM / Google Ads (doublons de conversion) | NON EXÉCUTÉ — hors mandat |
| Performance (protocole Lighthouse du dossier) | NON EXÉCUTÉ |
| Test des résultats enrichis Google | NON EXÉCUTÉ |
| Accessibilité de la page DGCCRF (source R01) | NON VÉRIFIÉE — le site renvoie 403 aux robots |

## Points restant à valider avant publication

1. **Avis Google** : renseigner dans `src/lib/preuves.ts` l’URL exacte de la fiche IS DIAG et la date de
   contrôle de la note pour réactiver note, avis et `aggregateRating`. D’ici là, le repli « Soloris, une
   marque d’IS DIAG » s’affiche. **La note « 4,9 · 111 avis » reste affichée dans l’en-tête de QuoteForm**
   (structure du formulaire préservée) : à aligner sur la même décision.
2. **Portrait LP** : `PREUVES.portraitEquipe` reste `false` tant que la personne photographiée n’est pas
   confirmée (intervenant réel + accord).
3. **Certifications et assurance** : aucun organisme, numéro ni attestation publié ; bloc « Des preuves
   consultables » de /methode non publié. Vérifier aussi l’habilitation pour l’audit énergétique.
4. **Délais** : « rapports généralement remis sous 24 h après la visite » (DPE/packs) et « rappel sous
   30 min, du lundi au samedi de 8 h à 19 h » (décision de l’exploitant du 14/10, alignée sur les annonces)
   à confirmer opérationnellement ; repli prêt : `WORDING.rappelCourt`. Plus aucun « rendez-vous sous 48 h ».
5. **Annexe 99 €** : la clé `ADDON_PRICE.cave` (99 €) n’est plus affichée comme supplément sur /tarifs ;
   la donnée reste dans `pricing.ts` (protégé) → ticket séparé après recherche de ses consommateurs.
6. **Photo de la fiche gaz** retirée (elle montrait un tableau électrique) : fournir un visuel pertinent et autorisé.
7. **Guides** : `dateModified` = 15/10/2026 ; à mettre à jour au jour de la mise en ligne si elle est postérieure.
   Revérifier les dates réglementaires à la publication (la page service-public affiche « vérifié le 1er janvier 2026 »
   alors qu’elle cite l’arrêté du 19 août 2026).
8. **Liens `tel:` ajoutés** (CTA « Parler de ce diagnostic » sur les 8 fiches) : même numéro, même écouteur
   global ; ils peuvent augmenter les clics « appel » mesurés.
9. **Test A/B vente** : contenus A et B identiques hors traitement du prix, mais le texte a changé →
   ouvrir une **nouvelle période de mesure** au déploiement.
10. **Confidentialité** : texte juridique non réécrit (doc §17) ; audit séparé du cookie `soloris_acq`,
    des expériences et de la phrase « aucun cookie… n’est déposé » par défaut.
11. **Annonces Google Ads** : les annonces relais n’ont pas été mises en pause par ce chantier (mandat :
    aucune modification de campagne).
