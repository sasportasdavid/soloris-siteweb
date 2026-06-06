/**
 * Helpers Telegram partagés (carte lead + libellés). Aucune clé ici (côté appelant).
 */

/** Clavier inline sous chaque carte lead. callback_data court (< 64 octets). */
export function leadKeyboard(leadId: string) {
  return {
    inline_keyboard: [[
      { text: 'Contacté', callback_data: 'ct|' + leadId },
      { text: '📅 Caler le RDV', callback_data: 'rdv|' + leadId },
      { text: 'Perdu', callback_data: 'pd|' + leadId },
    ]],
  };
}

export const STATUT_LABELS_TG: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', rdv_pris: 'RDV pris',
  realise: 'Réalisé', facture: 'Facturé', perdu: 'Perdu',
};
