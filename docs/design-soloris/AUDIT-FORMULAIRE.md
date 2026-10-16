# Audit formulaire du 16/10/2026 — suites données

Source : `Soloris_Audit_Formulaire_2026-10-16` (audit externe, référence `9e6ae43`).
Contrat respecté : valeurs métier, noms de champs, `data-el`, `lead_uid`, endpoints, tables,
consentement, identifiants publicitaires, conversions directes et événement `lead_submitted`
inchangés. Le conteneur GTM publié (GTM-NDRLHD4N, version 5) ne déclenche que sur `gtm.init`,
`gtm.js` et `lead_submitted` : aucun déclencheur ne dépend des textes du formulaire.

Recette isolée : `scripts/controles/audit-formulaire.mjs` (14 PASS), `forms.e2e.mjs` 30 PASS
(U02 lecteur d'écran NON EXÉCUTÉ), `tickets-f.mjs` 16 PASS. Les cas B1/B2 (email) et B3 (numéro
international) sont en ÉCHEC sur la production précédente : défauts reproduits avant correction.

| § audit | Point | Statut |
|---|---|---|
| 4.1 | Vue `v_form_funnel` (toutes pages, par jour / canal / page d'entrée) | **Appliqué** (migration 14, additive, `security_invoker`, pas d'accès anon) ; `v_devis_funnel` conservée |
| 4.2 | `form_submit` = tentative ; succès = lead complet | **Documenté** dans la vue (colonnes `tentatives_envoi` / `demandes_enregistrees`) ; tracker inchangé |
| 5.1 | Libellés « Pack de diagnostics pour vendre / louer », « DPE uniquement », « Audit énergétique » + aide « Vous hésitez ? » (appel) | **Appliqué** (valeurs vente/location/dpe/audit inchangées) |
| 5.1 | Résumé « Votre demande : DPE uniquement — Modifier » sur les pages DPE | Non appliqué : modifie la structure des étapes et la mesure `form_step` |
| 5.2 | Information DPE neutre ; seul « Choisir le pack location » change le projet | **Appliqué** |
| 6 | Libellés d'âge orientés construction (règle tarifaire inchangée) ; « Code postal du bien » | **Appliqué** (formulaire seulement ; `AGE_LABELS` de pricing.ts inchangé) |
| 6 | Réponse « Je ne connais pas l'année » | **Décision requise** : représentation et traitement tarifaire à définir (aucune 4ᵉ valeur injectée) |
| 7 | Texte d'entrée selon la sortie réelle (estimation après envoi / tarif confirmé par l'équipe) ; « Dernière étape : comment vous recontacter ? » | **Appliqué** |
| 7 | Test du prix avant coordonnées ; texte du bouton en variante `cta_devis` B | Non appliqué : expériences en cours, décision commerciale (ticket F5) |
| 8 | Usage du téléphone expliqué ; « Soloris, marque exploitée par IS DIAG. Demande gratuite, aucun paiement à cette étape. » | **Appliqué** (promesse de rappel sous 30 min conservée) |
| 8 | Information au point de collecte anticipée (partiels au blur) | **Décision requise** : texte et base légale à valider |
| 9.1 | Email facultatif invalide : contrôle local (même règle que l'API), message relié, réponses conservées ; partiel transmis sans l'email invalide | **Appliqué** |
| 9.2 | Conversions améliorées : `00XX…` → `+XX…` (avant : `+3300…`) | **Appliqué** |
| 9.2 | Surfaces décimales (`parseInt`) | **Décision requise** : politique d'arrondi à fixer avec le responsable tarifaire |
| 10 | Confirmation : « bien enregistrée », récapitulatif (projet, bien, surface, commune), « aucun paiement », rappel « dès l'ouverture » hors horaires (Europe/Paris, `SITE.rappel.ouverture`) | **Appliqué** (jours fériés non gérés) |
