-- ============================================================================
-- ROLLBACK Migration 1 — Analytics comportemental first-party (Soloris)
-- Restaure l'état antérieur : supprime les tables/fonctions analytics, retire
-- les 2 colonnes ajoutées sur leads, et restaure upsert_lead dans sa version
-- d'origine (sans session_id / visitor_id).
-- ============================================================================

drop function if exists public.ingest_analytics(jsonb);
drop function if exists public.purge_visitor_analytics(uuid);

-- Retire le lien lead → session des tables analytics avant de les supprimer
drop table if exists public.analytics_replay_chunks;
drop table if exists public.analytics_events;
drop table if exists public.analytics_heatmap_daily;
drop table if exists public.analytics_sessions;

alter table public.leads drop column if exists session_id;
alter table public.leads drop column if exists visitor_id;

-- Restauration de upsert_lead dans sa version d'origine (pré-migration 1)
create or replace function public.upsert_lead(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := nullif(payload->>'lead_uid','')::uuid;
  v_status text := coalesce(nullif(payload->>'lead_status',''), 'partiel');
  v_row leads;
  v_notify_partial boolean := false;
  v_notify_complete boolean := false;
begin
  if v_status not in ('partiel','complet') then v_status := 'partiel'; end if;

  if v_uid is not null then
    select * into v_row from leads where lead_uid = v_uid;
  end if;

  if v_row.id is null then
    insert into leads (
      lead_uid, lead_status, source, type_demande, type_bien, age_bien, surface,
      secteur, estimation, nom, telephone, email, message,
      annexe, annexe_type,
      utm_source, medium, campaign, term, content, gclid, fbclid,
      gads_keyword, gads_campaign_id, gads_adgroup_id, gads_creative_id,
      match_type, device, network, landing_path, referrer, updated_at
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
      nullif(payload->>'referrer',''), now()
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
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  if v_row.lead_status = 'complet' and coalesce(v_row.notified_complete,false) = false then
    update leads set notified_complete = true where id = v_row.id;
    v_notify_complete := true;
  elsif v_row.lead_status = 'partiel'
        and (v_row.telephone is not null or v_row.email is not null)
        and coalesce(v_row.notified_partial,false) = false then
    update leads set notified_partial = true where id = v_row.id;
    v_notify_partial := true;
  end if;

  return jsonb_build_object(
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
