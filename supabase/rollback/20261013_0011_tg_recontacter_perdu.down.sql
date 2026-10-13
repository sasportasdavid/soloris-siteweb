-- Rollback migration 11 : retire les RPC « à recontacter » / « perdu » et rétablit tg_set_status
-- (corps de la migration 10, 'perdu' accepté sans commentaire).
-- get_lead_for_card garde ses clés en plus (additives, sans effet sur les anciens appelants).
drop function if exists public.tg_set_recontacter(uuid, date, text);
drop function if exists public.tg_set_perdu(uuid, text, text, text);

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
  update leads set
      statut = p_statut,
      first_contact_at = case when first_contact_at is null and p_statut <> 'nouveau' then now() else first_contact_at end,
      traite_par = coalesce(nullif(p_traite_par,''), traite_par),
      updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  insert into lead_activity (lead_id, type, detail, par)
    values (p_id, 'statut', p_statut, nullif(p_traite_par,''));

  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'nom', v_row.nom, 'telephone', v_row.telephone, 'type_demande', v_row.type_demande,
    'secteur', v_row.secteur, 'estimation', v_row.estimation, 'statut', v_row.statut,
    'traite_par', v_row.traite_par, 'telegram_message_id', v_row.telegram_message_id
  ));
end;
$function$;

-- La colonne perte_commentaire est conservée (données saisies) ; à supprimer à la main si besoin :
-- alter table public.leads drop column if exists perte_commentaire;
