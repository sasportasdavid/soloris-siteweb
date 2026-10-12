-- ============================================================================
-- Migration 9 — Statut « à recontacter » accepté partout + montants pipeline
-- 1. tg_set_status (RPC appelée par /api/admin/lead-update) validait une liste
--    figée sans 'a_recontacter' → « Statut invalide ». On l'ajoute.
-- 2. Montants de suivi commercial : montant_devis (devisé) + montant_valide (gagné).
-- ============================================================================

create or replace function public.tg_set_status(p_id uuid, p_statut text, p_traite_par text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row leads;
begin
  if p_statut not in ('nouveau','contacte','a_recontacter','rdv_pris','realise','facture','perdu') then
    return jsonb_build_object('ok', false, 'error', 'bad_statut');
  end if;
  update leads set statut = p_statut, traite_par = coalesce(nullif(p_traite_par,''), traite_par), updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'nom', v_row.nom, 'telephone', v_row.telephone, 'type_demande', v_row.type_demande,
    'secteur', v_row.secteur, 'estimation', v_row.estimation, 'statut', v_row.statut,
    'traite_par', v_row.traite_par, 'telegram_message_id', v_row.telegram_message_id
  ));
end;
$function$;

alter table public.leads add column if not exists montant_devis numeric;  -- montant devisé au client
alter table public.leads add column if not exists montant_valide numeric; -- montant validé / gagné
