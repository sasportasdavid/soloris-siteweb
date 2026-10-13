-- ============================================================================
-- Migration 11 — « À recontacter » (date) et « Perdu » (motif + commentaire obligatoire)
-- depuis Telegram comme depuis /admin (Soloris). Additive, sauf tg_set_status qui refuse
-- désormais 'perdu' : passer par tg_set_perdu (commentaire obligatoire).
-- 1. tg_set_recontacter : statut 'a_recontacter' + recontacter_le en un seul appel.
-- 2. perte_commentaire + tg_set_perdu : statut 'perdu' + motif_perte + commentaire.
-- 3. tg_set_status : 'perdu' refusé (error 'commentaire_requis').
-- 4. get_lead_for_card renvoie recontacter_le, motif_perte, perte_commentaire (carte Telegram).
-- Tous mettent à jour first_contact_at, traite_par et le journal lead_activity (migration 10).
-- Rollback : supabase/rollback/20261013_0011_tg_recontacter_perdu.down.sql
-- ============================================================================

alter table public.leads add column if not exists perte_commentaire text; -- pourquoi le lead est perdu (obligatoire)

-- ── 1. À recontacter + date ──
create or replace function public.tg_set_recontacter(p_id uuid, p_date date, p_traite_par text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads;
begin
  if p_date is null or p_date < (now() at time zone 'Europe/Paris')::date
     or p_date > (now() at time zone 'Europe/Paris')::date + 366 then
    return jsonb_build_object('ok', false, 'error', 'bad_date');
  end if;
  update leads set
      statut = 'a_recontacter',
      recontacter_le = p_date,
      first_contact_at = coalesce(first_contact_at, now()),
      traite_par = coalesce(nullif(p_traite_par,''), traite_par),
      updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  insert into lead_activity (lead_id, type, detail, par)
    values (p_id, 'statut', 'a_recontacter · ' || to_char(p_date, 'YYYY-MM-DD'), nullif(p_traite_par,''));

  return jsonb_build_object('ok', true, 'id', v_row.id, 'recontacter_le', v_row.recontacter_le);
end;
$function$;

-- ── 2. Perdu + motif + commentaire obligatoire ──
create or replace function public.tg_set_perdu(p_id uuid, p_motif text, p_commentaire text, p_traite_par text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row leads;
  v_com text := left(btrim(coalesce(p_commentaire, '')), 1000);
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if length(v_com) < 3 then return jsonb_build_object('ok', false, 'error', 'commentaire_requis'); end if;
  if v_motif is not null and v_motif not in ('prix','delai','injoignable','concurrent','pas_decideur','reporte','autre') then
    return jsonb_build_object('ok', false, 'error', 'bad_motif');
  end if;
  update leads set
      statut = 'perdu',
      motif_perte = coalesce(v_motif, motif_perte, 'autre'),
      perte_commentaire = v_com,
      first_contact_at = coalesce(first_contact_at, now()),
      traite_par = coalesce(nullif(p_traite_par,''), traite_par),
      updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  insert into lead_activity (lead_id, type, detail, par)
    values (p_id, 'statut', 'perdu · ' || v_row.motif_perte || ' · ' || v_com, nullif(p_traite_par,''));

  return jsonb_build_object('ok', true, 'id', v_row.id, 'motif_perte', v_row.motif_perte, 'perte_commentaire', v_row.perte_commentaire);
end;
$function$;

revoke all on function public.tg_set_recontacter(uuid, date, text) from public;
revoke all on function public.tg_set_perdu(uuid, text, text, text) from public;
grant execute on function public.tg_set_recontacter(uuid, date, text) to anon, authenticated;
grant execute on function public.tg_set_perdu(uuid, text, text, text) to anon, authenticated;

-- ── 3. tg_set_status : corps identique à la migration 10, 'perdu' renvoyé vers tg_set_perdu ──
create or replace function public.tg_set_status(p_id uuid, p_statut text, p_traite_par text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row leads;
begin
  if p_statut = 'perdu' then
    return jsonb_build_object('ok', false, 'error', 'commentaire_requis');
  end if;
  if p_statut not in ('nouveau','contacte','a_recontacter','rdv_pris','realise','facture') then
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

-- ── 4. get_lead_for_card : corps identique à la migration 7, + rappel et perte ──
create or replace function public.get_lead_for_card(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads; v_op text;
begin
  select * into v_row from leads where id = p_id;
  if v_row.id is null then return jsonb_build_object('found', false); end if;
  select nom into v_op from operateurs where id = v_row.assigne_a;
  return jsonb_build_object('found', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'lead_status', v_row.lead_status, 'source', v_row.source,
    'type_demande', v_row.type_demande, 'type_bien', v_row.type_bien, 'age_bien', v_row.age_bien,
    'surface', v_row.surface, 'secteur', v_row.secteur, 'ville', v_row.ville, 'estimation', v_row.estimation,
    'annexe', v_row.annexe, 'annexe_type', v_row.annexe_type,
    'nom', v_row.nom, 'telephone', v_row.telephone, 'email', v_row.email, 'message', v_row.message,
    'gads_keyword', v_row.gads_keyword, 'campaign', v_row.campaign, 'landing_path', v_row.landing_path,
    'statut', v_row.statut, 'traite_par', v_row.traite_par,
    'rdv_at', v_row.rdv_at, 'rdv_adresse', v_row.rdv_adresse, 'prestation', v_row.prestation,
    'prix_total_ttc', v_row.prix_total_ttc, 'montant', v_row.montant,
    'recontacter_le', v_row.recontacter_le, 'motif_perte', v_row.motif_perte, 'perte_commentaire', v_row.perte_commentaire,
    'telegram_message_id', v_row.telegram_message_id, 'assigne_a', v_row.assigne_a, 'assigne_nom', v_op
  ));
end;
$function$;

grant execute on function public.get_lead_for_card(uuid) to anon, authenticated;
