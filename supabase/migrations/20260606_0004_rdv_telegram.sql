-- ============================================================================
-- Migration 4 — RDV + Telegram bidirectionnel (Soloris)
-- Additive. Colonnes telegram_message_id / traite_par + RPC security definer
-- partagées par le back-office (JWT) et le lien public signé (token HMAC).
-- Rollback : 20260606_0004_rdv_telegram.down.sql
-- ============================================================================

alter table public.leads
  add column if not exists telegram_message_id bigint, -- id de la carte Telegram du lead (réécriture)
  add column if not exists traite_par           text;  -- qui a confirmé/traité (nom)

-- ── upsert_lead : renvoie aussi 'id' (additif, pour stocker telegram_message_id) ──
create or replace function public.upsert_lead(payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := nullif(payload->>'lead_uid','')::uuid;
  v_status text := coalesce(nullif(payload->>'lead_status',''), 'partiel');
  v_row leads;
  v_notify_partial boolean := false;
  v_notify_complete boolean := false;
begin
  if v_status not in ('partiel','complet') then v_status := 'partiel'; end if;
  if v_uid is not null then select * into v_row from leads where lead_uid = v_uid; end if;

  if v_row.id is null then
    insert into leads (
      lead_uid, lead_status, source, type_demande, type_bien, age_bien, surface,
      secteur, estimation, nom, telephone, email, message, annexe, annexe_type,
      utm_source, medium, campaign, term, content, gclid, fbclid,
      gads_keyword, gads_campaign_id, gads_adgroup_id, gads_creative_id,
      match_type, device, network, landing_path, referrer, session_id, visitor_id, updated_at
    ) values (
      v_uid, v_status, nullif(payload->>'source',''), nullif(payload->>'type_demande',''),
      nullif(payload->>'type_bien',''), nullif(payload->>'age_bien',''),
      nullif(payload->>'surface','')::int, nullif(payload->>'secteur',''),
      nullif(payload->>'estimation','')::int, nullif(payload->>'nom',''),
      nullif(payload->>'telephone',''), nullif(payload->>'email',''), nullif(payload->>'message',''),
      coalesce(nullif(payload->>'annexe','')::boolean, false), nullif(payload->>'annexe_type',''),
      nullif(payload->>'utm_source',''), nullif(payload->>'medium',''),
      nullif(payload->>'campaign',''), nullif(payload->>'term',''),
      nullif(payload->>'content',''), nullif(payload->>'gclid',''), nullif(payload->>'fbclid',''),
      nullif(payload->>'gads_keyword',''), nullif(payload->>'gads_campaign_id',''),
      nullif(payload->>'gads_adgroup_id',''), nullif(payload->>'gads_creative_id',''),
      nullif(payload->>'match_type',''), nullif(payload->>'device',''),
      nullif(payload->>'network',''), nullif(payload->>'landing_path',''),
      nullif(payload->>'referrer',''),
      nullif(payload->>'session_id','')::uuid, nullif(payload->>'visitor_id','')::uuid, now()
    ) returning * into v_row;
  else
    update leads set
      lead_status = case when v_status = 'complet' then 'complet' else lead_status end,
      type_demande = coalesce(nullif(payload->>'type_demande',''), type_demande),
      type_bien = coalesce(nullif(payload->>'type_bien',''), type_bien),
      age_bien = coalesce(nullif(payload->>'age_bien',''), age_bien),
      surface = coalesce(nullif(payload->>'surface','')::int, surface),
      secteur = coalesce(nullif(payload->>'secteur',''), secteur),
      estimation = coalesce(nullif(payload->>'estimation','')::int, estimation),
      nom = coalesce(nullif(payload->>'nom',''), nom),
      telephone = coalesce(nullif(payload->>'telephone',''), telephone),
      email = coalesce(nullif(payload->>'email',''), email),
      message = coalesce(nullif(payload->>'message',''), message),
      annexe = coalesce(nullif(payload->>'annexe','')::boolean, annexe),
      annexe_type = coalesce(nullif(payload->>'annexe_type',''), annexe_type),
      utm_source = coalesce(utm_source, nullif(payload->>'utm_source','')),
      medium = coalesce(medium, nullif(payload->>'medium','')),
      campaign = coalesce(campaign, nullif(payload->>'campaign','')),
      term = coalesce(term, nullif(payload->>'term','')),
      content = coalesce(content, nullif(payload->>'content','')),
      gclid = coalesce(gclid, nullif(payload->>'gclid','')),
      fbclid = coalesce(fbclid, nullif(payload->>'fbclid','')),
      gads_keyword = coalesce(gads_keyword, nullif(payload->>'gads_keyword','')),
      gads_campaign_id = coalesce(gads_campaign_id, nullif(payload->>'gads_campaign_id','')),
      gads_adgroup_id = coalesce(gads_adgroup_id, nullif(payload->>'gads_adgroup_id','')),
      gads_creative_id = coalesce(gads_creative_id, nullif(payload->>'gads_creative_id','')),
      match_type = coalesce(match_type, nullif(payload->>'match_type','')),
      device = coalesce(device, nullif(payload->>'device','')),
      network = coalesce(network, nullif(payload->>'network','')),
      landing_path = coalesce(landing_path, nullif(payload->>'landing_path','')),
      referrer = coalesce(referrer, nullif(payload->>'referrer','')),
      session_id = coalesce(session_id, nullif(payload->>'session_id','')::uuid),
      visitor_id = coalesce(visitor_id, nullif(payload->>'visitor_id','')::uuid),
      updated_at = now()
    where id = v_row.id returning * into v_row;
  end if;

  if v_row.session_id is not null then
    update public.analytics_sessions set lead_id = v_row.id where id = v_row.session_id and lead_id is null;
  end if;

  if v_row.lead_status = 'complet' and coalesce(v_row.notified_complete,false) = false then
    update leads set notified_complete = true where id = v_row.id; v_notify_complete := true;
  elsif v_row.lead_status = 'partiel'
        and (v_row.telephone is not null or v_row.email is not null)
        and coalesce(v_row.notified_partial,false) = false then
    update leads set notified_partial = true where id = v_row.id; v_notify_partial := true;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'lead_uid', v_row.lead_uid,
    'lead_status', v_row.lead_status,
    'notify_partial', v_notify_partial,
    'notify_complete', v_notify_complete,
    'lead', jsonb_build_object(
      'type_demande', v_row.type_demande, 'type_bien', v_row.type_bien, 'age_bien', v_row.age_bien,
      'surface', v_row.surface, 'estimation', v_row.estimation, 'secteur', v_row.secteur,
      'nom', v_row.nom, 'telephone', v_row.telephone, 'email', v_row.email, 'message', v_row.message,
      'annexe', v_row.annexe, 'annexe_type', v_row.annexe_type,
      'source', v_row.source, 'gads_keyword', v_row.gads_keyword, 'campaign', v_row.campaign,
      'gads_campaign_id', v_row.gads_campaign_id, 'gads_creative_id', v_row.gads_creative_id,
      'gclid', v_row.gclid, 'landing_path', v_row.landing_path
    )
  );
end;
$function$;

-- ── Stocke le message_id de la carte Telegram du lead ──
create or replace function public.set_lead_tg_message_id(p_id uuid, p_message_id bigint)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  update leads set telegram_message_id = p_message_id where id = p_id;
end;
$function$;

-- ── Enregistre un RDV (cœur partagé back-office + lien public). Idempotent. ──
create or replace function public.rdv_save(payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid := nullif(payload->>'lead_id','')::uuid;
  v_resend boolean := coalesce((payload->>'resend')::boolean, false);
  v_row leads;
begin
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  select * into v_row from leads where id = v_id;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if v_row.confirmation_rdv_envoyee_at is not null and not v_resend then
    return jsonb_build_object('ok', false, 'needsConfirm', true,
      'confirmation_rdv_envoyee_at', v_row.confirmation_rdv_envoyee_at);
  end if;

  update leads set
    rdv_at         = coalesce(nullif(payload->>'rdv_at','')::timestamptz, rdv_at),
    rdv_adresse    = nullif(payload->>'rdv_adresse',''),
    prestation     = nullif(payload->>'prestation',''),
    diagnostiqueur = nullif(payload->>'diagnostiqueur',''),
    prix_total_ttc = nullif(payload->>'prix_total_ttc','')::numeric,
    duree_estimee  = nullif(payload->>'duree_estimee',''),
    consignes      = nullif(payload->>'consignes',''),
    traite_par     = coalesce(nullif(payload->>'traite_par',''), traite_par),
    statut         = 'rdv_pris',
    updated_at     = now()
  where id = v_id returning * into v_row;

  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'nom', v_row.nom, 'email', v_row.email, 'telephone', v_row.telephone,
    'rdv_at', v_row.rdv_at, 'rdv_adresse', v_row.rdv_adresse, 'prestation', v_row.prestation,
    'diagnostiqueur', v_row.diagnostiqueur, 'prix_total_ttc', v_row.prix_total_ttc,
    'duree_estimee', v_row.duree_estimee, 'consignes', v_row.consignes,
    'traite_par', v_row.traite_par, 'telegram_message_id', v_row.telegram_message_id
  ));
end;
$function$;

-- ── Stampe l'envoi (idempotence) ──
create or replace function public.rdv_mark_sent(p_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  update leads set confirmation_rdv_envoyee_at = now() where id = p_id;
end;
$function$;

-- ── Changement de statut depuis Telegram (boutons Contacté / Perdu) ──
create or replace function public.tg_set_status(p_id uuid, p_statut text, p_traite_par text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads;
begin
  if p_statut not in ('nouveau','contacte','rdv_pris','realise','facture','perdu') then
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

-- ── Données de pré-remplissage pour le formulaire public /rdv/{token} ──
create or replace function public.get_lead_for_rdv(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads;
begin
  select * into v_row from leads where id = p_id;
  if v_row.id is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object(
    'found', true,
    'already_confirmed', (v_row.confirmation_rdv_envoyee_at is not null),
    'lead', jsonb_build_object(
      'id', v_row.id, 'nom', v_row.nom, 'secteur', v_row.secteur, 'adresse', v_row.adresse,
      'type_demande', v_row.type_demande, 'type_bien', v_row.type_bien, 'surface', v_row.surface,
      'age_bien', v_row.age_bien, 'estimation', v_row.estimation, 'annexe', v_row.annexe,
      'annexe_type', v_row.annexe_type, 'rdv_at', v_row.rdv_at, 'rdv_adresse', v_row.rdv_adresse,
      'prestation', v_row.prestation, 'diagnostiqueur', v_row.diagnostiqueur,
      'prix_total_ttc', v_row.prix_total_ttc, 'duree_estimee', v_row.duree_estimee, 'consignes', v_row.consignes
    )
  );
end;
$function$;

revoke all on function public.set_lead_tg_message_id(uuid, bigint) from public;
revoke all on function public.rdv_save(jsonb) from public;
revoke all on function public.rdv_mark_sent(uuid) from public;
revoke all on function public.tg_set_status(uuid, text, text) from public;
revoke all on function public.get_lead_for_rdv(uuid) from public;
grant execute on function public.set_lead_tg_message_id(uuid, bigint) to anon, authenticated;
grant execute on function public.rdv_save(jsonb) to anon, authenticated;
grant execute on function public.rdv_mark_sent(uuid) to anon, authenticated;
grant execute on function public.tg_set_status(uuid, text, text) to anon, authenticated;
grant execute on function public.get_lead_for_rdv(uuid) to anon, authenticated;
