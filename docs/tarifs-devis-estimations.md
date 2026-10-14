# Règles tarifaires, estimations et devis — Soloris

État du code au 14 octobre 2026, avec les décisions « DPE seul à 150 € minimum, 15 € de plus pour une maison », « audit énergétique de 450 à 900 € » et le rappel pour la location.
Document établi par lecture du code. Les tables de prix sont calculées directement depuis `src/lib/pricing.ts`, jamais recopiées à la main.

## 1. Principes généraux

- Tous les montants sont en **euros TTC, entiers**, **déplacement inclus**.
- Périmètre inclus : **Paris et toute l'Île-de-France** (départements 75, 77, 78, 91, 92, 93, 94, 95). Le formulaire n'accepte que ces codes postaux.
- L'estimation est toujours présentée comme **« à partir de »**. Le prix exact est confirmé au rappel puis au devis.
- Interdits de communication : prix barré, promotion, remise en pourcentage, compte à rebours.
- **Source de vérité unique : `src/lib/pricing.ts`.** Le formulaire côté navigateur reçoit les mêmes constantes. Aucun prix n'est écrit en dur ailleurs dans le code, hors commentaires (voir la section 12 pour les restes obsolètes).

## 2. Pack diagnostics vente et location

Même grille pour la vente et la location. Le prix dépend de **trois critères** : surface, âge du bien, type de bien.

**Âge du bien** : il détermine les diagnostics obligatoires.

| Âge | Clé interne | Diagnostics en plus |
|---|---|---|
| Avant 1949 | `avant1949` | amiante et plomb |
| De 1949 à moins de 15 ans | `intermediaire` | amiante |
| Moins de 15 ans | `recent` | ni amiante ni plomb |

**Formule**

1. Prix de base = prix appartement de la grille, selon la bande de surface et l'âge.
2. Maison : **+ 30 €**.
3. Maison en copropriété : **+ 20 € de plus**, donc appartement + 50 €.
4. Cave, parking, box, garage ou dépendance rattachés au logement : **inclus, 0 €**.
5. ERP (état des risques) : offert dans les packs.
6. Plus de 239 m² : **sur devis**, aucun prix calculé.

**Bandes de surface** : la borne haute est incluse. 20 m² tombe dans « Jusqu'à 20 m² », 21 m² dans « 20 à 39 m² », 239 m² dans « 220 à 239 m² », 240 m² est sur devis.

Accroche publique « dès 159 € » : c'est le minimum de la grille, appartement récent de 20 m² ou moins.

### Appartement

| Surface | Avant 1949 | 1949 à moins de 15 ans | Moins de 15 ans |
|---|---:|---:|---:|
| Jusqu’à 20 m² | 199 € | 189 € | 159 € |
| 20 à 39 m² | 229 € | 219 € | 189 € |
| 40 à 59 m² | 249 € | 239 € | 209 € |
| 60 à 79 m² | 269 € | 259 € | 229 € |
| 80 à 99 m² | 289 € | 279 € | 249 € |
| 100 à 119 m² | 309 € | 299 € | 269 € |
| 120 à 139 m² | 329 € | 319 € | 289 € |
| 140 à 159 m² | 349 € | 339 € | 309 € |
| 160 à 179 m² | 369 € | 359 € | 329 € |
| 180 à 199 m² | 389 € | 379 € | 349 € |
| 200 à 219 m² | 409 € | 399 € | 369 € |
| 220 à 239 m² | 429 € | 419 € | 389 € |
| Plus de 239 m² | Sur devis | Sur devis | Sur devis |

### Maison

| Surface | Avant 1949 | 1949 à moins de 15 ans | Moins de 15 ans |
|---|---:|---:|---:|
| Jusqu’à 20 m² | 229 € | 219 € | 189 € |
| 20 à 39 m² | 259 € | 249 € | 219 € |
| 40 à 59 m² | 279 € | 269 € | 239 € |
| 60 à 79 m² | 299 € | 289 € | 259 € |
| 80 à 99 m² | 319 € | 309 € | 279 € |
| 100 à 119 m² | 339 € | 329 € | 299 € |
| 120 à 139 m² | 359 € | 349 € | 319 € |
| 140 à 159 m² | 379 € | 369 € | 339 € |
| 160 à 179 m² | 399 € | 389 € | 359 € |
| 180 à 199 m² | 419 € | 409 € | 379 € |
| 200 à 219 m² | 439 € | 429 € | 399 € |
| 220 à 239 m² | 459 € | 449 € | 419 € |
| Plus de 239 m² | Sur devis | Sur devis | Sur devis |

### Maison en copropriété

| Surface | Avant 1949 | 1949 à moins de 15 ans | Moins de 15 ans |
|---|---:|---:|---:|
| Jusqu’à 20 m² | 249 € | 239 € | 209 € |
| 20 à 39 m² | 279 € | 269 € | 239 € |
| 40 à 59 m² | 299 € | 289 € | 259 € |
| 60 à 79 m² | 319 € | 309 € | 279 € |
| 80 à 99 m² | 339 € | 329 € | 299 € |
| 100 à 119 m² | 359 € | 349 € | 319 € |
| 120 à 139 m² | 379 € | 369 € | 339 € |
| 140 à 159 m² | 399 € | 389 € | 359 € |
| 160 à 179 m² | 419 € | 409 € | 379 € |
| 180 à 199 m² | 439 € | 429 € | 399 € |
| 200 à 219 m² | 459 € | 449 € | 419 € |
| 220 à 239 m² | 479 € | 469 € | 439 € |
| Plus de 239 m² | Sur devis | Sur devis | Sur devis |

## 3. DPE seul

Le prix dépend de la **surface** et du **type de bien** (appartement ou maison), pas de l'âge. Décision du 14 octobre 2026 : il n'est pas rentable de se déplacer pour moins de 150 €, donc le **plancher est de 150 €** (ancien barème : 120, 150, 170 et 190 €). Le DPE d'une **maison** coûte **15 € de plus** que celui d'un appartement, sur chaque tranche.

| Surface | Appartement | Maison (+ 15 €) |
|---|---:|---:|
| Jusqu’à 20 m² | 150 € | 165 € |
| 20 à 39 m² | 150 € | 165 € |
| 40 à 59 m² | 160 € | 175 € |
| 60 à 79 m² | 160 € | 175 € |
| 80 à 99 m² | 170 € | 185 € |
| 100 à 119 m² | 170 € | 185 € |
| 120 à 139 m² | 190 € | 205 € |
| 140 à 159 m² | 190 € | 205 € |
| 160 à 179 m² | 190 € | 205 € |
| 180 à 199 m² | 190 € | 205 € |
| 200 à 219 m² | 190 € | 205 € |
| 220 à 239 m² | 190 € | 205 € |
| Plus de 239 m² | 190 € | 205 € |

Seuils : jusqu'à 39 m² : 150 € · jusqu'à 79 m² : 160 € · jusqu'à 119 m² : 170 € · au-delà : 190 €. Maison : + 15 € sur chaque tranche.
Si le type de bien n'est pas connu, le prix appartement s'applique.
Accroche publique « dès 150 € », plage annoncée 150 à 190 € (+ 15 € pour une maison).
Les leads et devis déjà créés gardent leur ancien montant, rien n'est recalculé.

### Rappel pour la location

Quand le visiteur choisit « DPE seul », l'étape de la surface affiche un encadré : « Pour louer, le DPE ne suffit pas. D'autres diagnostics sont obligatoires pour une mise en location, selon l'âge du bien. Le pack location les regroupe en un seul rendez-vous. »

- L'encadré ne contient **aucun prix**, donc il est compatible avec les pages sans prix à l'écran.
- Le bouton « Voir le pack location » ne quitte pas la page : il passe la demande à Location et ramène à l'étape du type de bien. Les pages sans navigation restent donc intactes.
- L'encadré ne s'affiche pas pour les autres demandes. Il fonctionne dans les deux variantes de l'ordre des étapes.

## 4. Audit énergétique

- Prix annoncé en **fourchette : de 450 à 900 €**, selon le bien (décision du 14 octobre 2026 ; ancien affichage : « dès 590 € »).
- L'estimation, la ligne du brouillon de devis et la valeur de conversion Google Ads prennent le **bas de la fourchette, 450 €**, quelle que soit la surface. Le prix réel se fixe au devis, entre 450 et 900 €.

## 5. Lot annexe vendu seul

- Cave, parking ou box diagnostiqué **seul** : **179 € tout compris**, tarif unique.
- Pas d'âge demandé, surface facultative, pas de DPE.
- Proposé seulement pour une demande de vente ou de location.
- À ne pas confondre avec l'annexe **rattachée** à un logement, qui est incluse (0 €).

## 6. Diagnostics à l'unité

Affichés sur `/tarifs` et sur les pages `/diagnostics/…`, à titre indicatif.

| Diagnostic | Tarif indicatif |
|---|---:|
| Amiante | dès 90 € |
| Plomb (CREP) | dès 130 € |
| Électricité + gaz | 190 € |
| Mesurage loi Carrez / Boutin | dès 70 € |
| ERP | 30 €, offert en pack |
| Termites | sur devis, aucun prix |
| Cave ou parking ajouté à un diagnostic de logement | 99 € (voir la section 12, point 1) |

## 7. Exemples vérifiés par le code

| Cas | Prix |
|---|---:|
| Appartement 60 m², 1960 (1949 à moins de 15 ans), vente | 259 € |
| Appartement 38 m², avant 1949, location | 229 € |
| Maison 120 m², récente, vente | 319 € |
| Maison 120 m², récente, en copropriété, vente | 339 € |
| Appartement 239 m², avant 1949, vente | 429 € |
| Appartement 240 m², avant 1949, vente | Sur devis |
| DPE seul, appartement 25 m² | 150 € |
| DPE seul, appartement 45 m² | 160 € |
| DPE seul, maison 45 m² | 175 € |
| DPE seul, appartement 150 m² | 190 € |
| DPE seul, maison 150 m² | 205 € |
| Audit énergétique (estimation) | 450 €, fourchette annoncée 450 à 900 € |
| Cave vendue seule | 179 € |

## 8. Où l'estimation est calculée et quand le visiteur la voit

**Calcul**

- **Formulaire** : à l'étape 3, l'estimation est **toujours calculée** et stockée dans un champ caché, même quand elle n'est pas affichée.
- **Repli serveur** (`/api/lead`) : si le navigateur n'a pas envoyé d'estimation mais que la demande et la surface sont connues, le serveur la calcule avec la même grille. Ce repli ignore la copropriété.
- **Création manuelle d'un lead dans l'admin** : si le prix est vide, il est calculé par la grille. Le prix convenu du lead reprend l'estimation.
- **Plus de 239 m²** : estimation vide. La carte Telegram affiche alors « à partir de 159 € (estimation à préciser) ».

**Affichage au visiteur**

- Pendant le parcours, le montant n'est **jamais affiché** : le visiteur voit « Votre estimation est prête » (ou « Obtenez votre devis personnalisé »).
- Sur les pages où l'estimation est « révélée », le montant apparaît **après l'envoi des coordonnées** : sur la page de remerciement (« à partir de X € »), et dans l'email de confirmation si l'email est renseigné. Un lead à téléphone seul ne voit donc le montant que sur la page de remerciement.
- Sur les autres pages, la page de remerciement ne montre aucun montant : le visiteur lit « devis personnalisé confirmé lors du rappel ». **Mais l'email de confirmation, lui, affiche toujours « à partir de X € » dès que le lead a un email et une estimation**, y compris pour un lead venu de ces pages.

| Montant affiché après contact | Montant masqué à l'écran |
|---|---|
| Accueil, `/devis`, `/tarifs`, pages `/diagnostics/…`, pages par zone, offres vente et location, LP vente avec prix | Page de remerciement sans montant : LP DPE, LP vente sans prix, offres DPE et audit, guide du prix |

## 9. Du lead au devis

### Brouillon de devis

Créé par le bouton « Générer un devis » de l'admin ou par le bouton Devis de Telegram. Le montant d'un brouillon est l'**estimation du lead**.

| Demande | Lignes générées | Montant |
|---|---|---|
| Vente ou location | « Pack diagnostics avant vente (ou location) — type de bien, surface, âge » + ligne « annexe — inclus » si l'option est cochée | estimation, annexe à 0 € |
| DPE | « Diagnostic de performance énergétique (DPE) — type de bien, surface » | estimation |
| Audit | « Audit énergétique réglementaire » | estimation (450 €, bas de la fourchette) |
| Lot annexe seul | « Diagnostics cave, parking ou box (lot vendu seul, tout compris) » | 179 € |
| Autre | libellé générique | estimation |

- Validité : **30 jours**. Numéro : `DEV-AAAA-NNNN`, séquence unique, année en UTC.
- Sans estimation (plus de 239 m²), le brouillon sort à **0 €** : le montant se saisit à la main.
- Le nom, l'email, le téléphone, le code postal et l'adresse du lead sont **copiés sur le devis à la création**. Une modification ultérieure depuis l'onglet Contact de l'admin est répercutée sur le devis.

### Édition dans l'admin

Objet, durée de validité et lignes (désignation + montant entier) sont modifiables. Le total est la somme des lignes. Il n'existe ni champ remise ni ventilation HT et TVA.

### Statuts et envoi

- Statuts : brouillon, envoyé, signé, refusé.
- Envoi par email avec le PDF en pièce jointe et un lien de signature. **Un devis sans email du client ne part pas**, ni depuis l'admin, ni depuis Telegram.
- Telegram bloque en plus un devis à 0 € et un devis déjà signé. L'admin n'a pas ce garde-fou sur le montant.
- À l'envoi ou à la signature, un lead « Nouveau » passe à « Contacté », sans jamais rétrograder un statut plus avancé.
- Signature : lien public, nom du signataire, IP et horodatage enregistrés. Le client peut aussi refuser.

### Mentions du PDF

- Montants en euros, **TTC**, déplacement inclus, ERP inclus dans les packs vente et location.
- Rapport transmis sous 48 h après réception du règlement, par un diagnostiqueur certifié avec assurance RC professionnelle.
- Devis valable 30 jours à compter de l'émission.
- Pied de page : raison sociale, SIREN, SIRET, numéro de TVA intracommunautaire, APE.

## 10. Rendez-vous et chiffre d'affaires

**Champs de montant d'un lead**

| Champ | Sens | Rempli par |
|---|---|---|
| `estimation` | prix « à partir de » issu de la grille | formulaire ou serveur |
| `prix_total_ttc` | prix **convenu** au rendez-vous | admin, prérempli |
| `montant_devis` | montant du devis, pour le suivi du CA | saisie manuelle |
| `montant_valide` | montant validé par le client | saisie manuelle |
| `montant` | montant facturé | saisie manuelle |

- Le prix du rendez-vous est prérempli ainsi : prix convenu existant, sinon montant du brouillon de devis, sinon estimation. Il reste éditable.
- L'email de confirmation de rendez-vous affiche ce prix : « Tarif tout compris X € TTC · déplacement inclus ».
- Les trois totaux du tableau de bord admin additionnent `montant_devis` (CA devis), `montant_valide` (CA validé) et `montant` des seuls leads au statut Facturé (CA facturé). Aucune de ces valeurs n'est alimentée automatiquement : seul l'admin les écrit. Les totaux **ne lisent donc pas** le montant de la table des devis.

## 11. Valeurs de conversion Google Ads

**Conversion du formulaire** (au dépôt d'un lead complet)

- Valeur : l'estimation si elle est positive, sinon **300 €** pour vente, location et audit, **150 €** pour le DPE.
- Action « Soloris - Devis DPE » pour les demandes DPE. Action « Soloris - Devis Vente » pour vente, location et audit. Un type de demande inconnu ne déclenche aucune conversion.

**Conversion hors-ligne « RDV pris » ou devis signé** (cron quotidien)

- Valeur, par ordre de priorité : montant du devis signé, prix convenu du rendez-vous, montant du lead, estimation, puis **200 €** à défaut.
- Envoyée une seule fois par lead, pour les leads ayant un identifiant de clic Google, sur une fenêtre de 85 jours.

## 12. Incohérences et points d'attention constatés

1. **Cave et parking : « +99 € » obsolète.** La règle appliquée est « annexe rattachée incluse, 0 € » dans la grille, le formulaire et le devis. Mais la page publique `/tarifs` affiche encore une ligne « Cave ou parking ajouté à un diagnostic de logement, 99 € ». L'admin affiche aussi « +99 € » sur la pastille et la fiche d'un lead avec annexe. Deux commentaires de code (`pricing.ts`, `lead.ts`) disent la même chose. À trancher et aligner.
2. **Repli serveur et copropriété.** Si l'estimation n'a pas été transmise par le navigateur, le serveur ignore la copropriété : une maison en copropriété est sous-estimée de 20 €.
3. **Devis à 0 €.** Les leads de plus de 239 m² donnent un brouillon à 0 €, que l'admin peut envoyer. Seul Telegram le bloque.
4. **Totaux de CA.** Ils lisent les champs saisis sur le lead, pas les devis. Un devis signé n'alimente pas « CA validé » tant que le champ n'est pas rempli à la main.
5. **Pas de ventilation HT et TVA** sur le devis : montants TTC uniquement.
6. **Audit : fourchette annoncée, montant unique en interne.** Le site annonce « de 450 à 900 € », mais l'estimation, le devis préparé et la valeur de conversion reprennent toujours 450 €. Il n'existe pas de règle qui place le prix dans la fourchette selon le bien : c'est l'admin qui saisit le montant réel au devis.
7. **DPE seul** : le prix dépend de la surface et du type de bien (maison + 15 €), jamais de l'âge. Un lead sans type de bien est estimé au prix appartement.
8. **Prix retirés des pages d'offre le 12 octobre** : « Dès X € » est remplacé par « Tarif tout compris » sur les pages d'offre et leurs FAQ. La grille, la page `/tarifs`, la LP vente avec prix et le guide du prix gardent les montants.
9. **Périmètre en double.** La constante de périmètre de `pricing.ts` n'est lue par aucun code. Le formulaire embarque sa propre liste de départements, qui est la seule règle réellement appliquée.
10. **Email et « pas de prix à l'écran ».** Sur les pages où le montant est masqué, l'email de confirmation l'affiche quand même s'il existe. À arbitrer si la règle de communication doit aussi couvrir l'email.
11. **Google Ads : anciens prix dans des extensions.** Les annonces textuelles actives ne citent aucun montant. En revanche, des liens annexes diffusés par les campagnes actives affichent encore d'anciens prix : « DPE seul, dès 120 € » (3 liens, dont un au niveau du compte), « Pack location, dès 180 € » (2 liens) et « Audit énergétique, dès 590 € » (1 lien). Les annonces en pause citent aussi « dès 120 € » (DPE), « dès 180 € » (pack location) et « dès 250 € » (pack vente). Le compte publicitaire n'a pas été modifié : à aligner ou à retirer avant toute réactivation.

## 13. Fichiers de référence

| Sujet | Fichier |
|---|---|
| Grille, DPE, audit, lots, diagnostics à l'unité, calcul `computePrix` | `src/lib/pricing.ts` |
| Estimation côté navigateur, conversion Google Ads du formulaire | `src/components/QuoteForm.astro` |
| Repli serveur de l'estimation | `src/pages/api/lead.ts` |
| Brouillon de devis, statuts | `src/lib/devis.ts` |
| Envoi du devis par email | `src/lib/devisSend.ts`, `src/pages/api/devis/send.ts` |
| PDF et mentions | `src/lib/devisPdf.ts` |
| Signature | fonction base de données `sign_devis`, `src/pages/api/devis/sign.ts` |
| Rendez-vous et prix convenu | `src/lib/rdvForm.ts`, `src/lib/rdvConfirm.ts`, `src/lib/rdvEmail.ts` |
| Email de confirmation de demande | `src/lib/confirmEmail.ts` |
| Page publique des tarifs | `src/pages/tarifs.astro`, `src/components/PricingTable.astro` |
| Conversion hors-ligne | `supabase/migrations/20261012_0007_gads_rdv_oci_signed.sql` |
| Carte Telegram | `src/lib/telegramCard.ts`, `src/lib/telegramDevis.ts` |
