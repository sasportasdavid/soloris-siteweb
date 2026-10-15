# Tickets séparés — NON APPLIQUÉS (validation distincte requise)

Ces évolutions dépassent le périmètre d'habillage (lots V/P). Le comportement actuel est conservé.
Chaque ticket touche au moins un fichier gelé ou un comportement de collecte : aucun n'est réputé
autorisé parce qu'il paraît bénéfique. Les références « cahier » renvoient au backlog du cahier Design UX V3.

## F1 — Barre mobile contextuelle (cahier F1)

- **Constat** : la barre mobile publique pointe vers `/devis` ; celle des LP vers `#simulateur` (instance basse),
  même si le visiteur a commencé l'instance du haut. Comportement conservé tel quel.
- **Cible** : au clic, retrouver le formulaire réellement commencé ; sinon l'ancre existante pertinente.
  Aucune mutation de champ ; conserver le lien `tel:`, l'acquisition et les événements de clic.
- **Fichiers** : `Header.astro` / barre mobile, `LandingLayout.astro` (barre `.lp-mcta`), éventuellement script dédié.
- **Recette** : deux instances (haut commencé / bas commencé / aucune), après succès, clavier, page sans formulaire,
  événement de clic inchangé dans `dataLayer`, aucune requête externe en recette.
- **Risque** : modifie une destination suivie par des déclencheurs GTM non visibles dans le dépôt.

## F2 — Progression verbale branchée aux étapes (cahier F2)

- **Constat** : la progression du devis est seulement visuelle (pastilles).
- **Cible** : « Étape X sur Y » calculé depuis l'état réel du moteur (`showStep`), Y cohérent avec `steps_order` (A/B).
- **Fichiers** : `QuoteForm.astro` (gelé).
- **Recette** : variantes `soloris_ab_steps` A et B, retour arrière, LP DPE, deux instances ; F01–F15 inchangés.

## F3 — Accessibilité du devis : clavier, erreurs, lecteurs d'écran (cahier F3, élargi)

Anomalies **préexistantes**, mesurées à l'identique sur la baseline `52ec190` et après V3
(parcours au clavier seul, API simulée : `scripts/controles/clavier-devis.mjs`) :

| Page | Avant | Après | Observation |
|---|---|---|---|
| `/devis/` | PASS | PASS | Devis complet au clavier ; le focus est bien placé sur le premier champ de chaque nouvelle étape. |
| `/dpe/` | ÉCHEC | ÉCHEC | Option « DPE seul » présélectionnée : Espace et Entrée sur le bouton radio déjà coché ne font pas avancer, et « Continuer » est masqué sur les étapes à avance automatique. Seule une flèche fait avancer, mais en changeant le projet (contournement : flèche, « Retour », flèche inverse). |
| `/lp/vente-prix/` | ÉCHEC | ÉCHEC | Même blocage avec « Vente » présélectionné. |
| `/lp/dpe/` | ÉCHEC | ÉCHEC | Même blocage avec « DPE seul » présélectionné. |

- **Autres points** : les erreurs de saisie sont signalées uniquement par une bordure rouge (style inline),
  sans message associé au champ ni `aria-invalid` (WCAG 1.4.1, 3.3.1) ; une flèche clavier dans un groupe radio
  à avance automatique valide l'option suivante et change d'étape immédiatement (vérifié, WCAG 3.2.2) ; le lecteur d'écran n'a pas été testé (U02 NON EXÉCUTÉ).
- **Cible** : activation clavier (Espace / Entrée) d'une option déjà cochée qui fait avancer, ou « Continuer » visible
  au clavier ; navigation par flèches sans changement d'étape tant que le choix n'est pas confirmé ; message d'erreur relié au champ (`aria-describedby`) et statut annoncé,
  **sans changer les règles de validation** ni les textes ciblés par des tags.
- **Fichiers** : `QuoteForm.astro` (gelé), éventuellement `CallbackForm.astro` / `ContactForm.astro`.
- **Recette** : parcours clavier seul sur `/devis/`, `/dpe/`, `/lp/vente-prix/`, `/lp/dpe/` ; lecteur d'écran (NVDA ou VoiceOver) ; F01–F15, T01–T05, C01–C02.

## F4 — Le chat présenté comme une demande de contact (cahier F4)

- **Cible** : libellé d'entrée « Poser une question », pas de promesse de conversation en direct ;
  mêmes endpoint, source et événement.
- **Fichiers** : `ChatWidget.astro` (gelé). Le texte actuel peut être suivi par un déclencheur.

## F5 — Test du prix avant contact (cahier F5)

- **Cible** : expérience commerciale propre (audience contrôlée, mesure des clients payés et de la marge, aucun prix trompeur).
- **Hors design** : change la proposition et le moment où le prix est révélé, que les lots V/P n'ont pas touché
  (vérifié : F07, F08a, F08b identiques à la baseline).

## M1 — Microcopie interne des formulaires (cahier M1)

- **Cible** : textes du dossier éditorial, appliqués avec un diff de chaînes exact ; champs, attributs et scripts vérifiés
  (`compare.mjs --mode=M`), recette F/T complète.
- **Points relevés pendant la recette V3** (non modifiés) :
  - « Diagnostiqueur : Diagnostiqueur certifié » (redondance dans l'aperçu de rapport, `ReportPreview.astro`) ;
  - la note Google affichée en tête du devis reste dans `QuoteForm.astro` (gelé).

## T1 — Attribution et consentement (cahier T1)

- **Constat vérifié dans le code** : `Analytics.astro` capture `gbraid` / `wbraid` dans le cookie d'acquisition,
  mais ces identifiants ne figurent ni dans le payload de `QuoteForm.astro` ni dans `src/pages/api/lead.ts`.
- **À examiner** : transmission gbraid/wbraid, statut des appels, capture partielle, configurations GTM/Ads publiées
  (non accessibles depuis le dépôt).
- **Hors refonte visuelle** : aucune modification de collecte n'a été faite.

## D1 — Suites de design possibles (hors périmètre de cette passe)

- Si la feuille V3 est retirée seule, les classes `v3-*` ajoutées dans les pages restent sans style
  (le résumé des prix de `/tarifs` redevient une liste à puces) : pour un retour complet, annuler aussi les commits P1–P3.
- Bouton désactivé pendant l'envoi : texte blanc sur `#8C7E74` (3,9:1). Exempté (composant inactif, WCAG 1.4.3),
  mais un fond plus sombre est possible dans un lot V ultérieur.
