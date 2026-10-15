/**
 * Preuves affichées sur le site — interrupteurs de PRÉSENTATION (dossier éditorial V2, oct. 2026).
 *
 * Une preuve n'est mise en avant que lorsqu'elle est documentée. Tant qu'un justificatif
 * manque, les composants affichent la formulation de repli prévue par le dossier
 * (« Soloris, une marque d'IS DIAG. »), sans supprimer les données de configuration :
 * la note et le nombre d'avis restent dans SITE.rating, les avis dans reviews.ts.
 *
 * Pour réactiver la note et les avis : renseigner l'URL EXACTE de la fiche Google de
 * l'exploitant (jamais une recherche générale) et la date du contrôle de la note, après
 * avoir vérifié que SITE.rating correspond toujours à la fiche.
 */
import { SITE } from './site';

export const PREUVES = {
  avisGoogle: {
    /** URL de la fiche Google IS DIAG (source de SITE.rating et des avis de reviews.ts). */
    ficheUrl: '',
    /** Date du contrôle de la note et du nombre d'avis (AAAA-MM-JJ). */
    dateControle: '',
  },
  /** Portrait /images/diagnostiqueur-soloris-avatar.webp : true uniquement si la personne
   *  photographiée intervient réellement pour Soloris et a donné son accord. */
  portraitEquipe: false,
};

/** Note et avis publiables (fiche identifiée + date de contrôle + avis présents). */
export const avisVerifies = Boolean(PREUVES.avisGoogle.ficheUrl && PREUVES.avisGoogle.dateControle && Number(SITE.rating.count) > 0);

/** Libellés de la preuve « avis », attribués à l'exploitant (uniquement si avisVerifies). */
export const AVIS_LIBELLE = `${SITE.legalName} : ${SITE.rating.value}/5 sur Google — ${SITE.rating.count} avis`;
export const AVIS_ATTRIBUTION = `Avis de la fiche Google ${SITE.legalName}, société qui exploite la marque ${SITE.tradeName}.`;

/** Repli du dossier lorsque la preuve n'est pas documentée. */
export const REPLI_PREUVE = {
  titre: `${SITE.tradeName}, une marque d’${SITE.legalName}.`,
  texte: 'Un interlocuteur pour préparer votre intervention et répondre à vos questions.',
};
