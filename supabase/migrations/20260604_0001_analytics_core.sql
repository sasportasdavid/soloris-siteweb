-- ============================================================================
-- Migration 1 — Analytics comportemental first-party (Soloris)
-- Additive uniquement : 4 tables analytics + 2 colonnes nullables sur leads
-- + fonction d'ingestion SECURITY DEFINER + purge consentement.
-- Aucune donnée existante modifiée. Rollback : 20260604_0001_analytics_core.down.sql
-- ============================================================================

-- ── 1. Sessions ─────────────────────────────────────────────────────────────
create table if not exists public.analytics_sessions (
  id            uuid primary key default gen_random_uuid(), -- fourni par le tracker (first-party)
  visitor_id    uuid not null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  duration_s    integer,
  entry_path    text,
  exit_path     text,
  page_count    integer not null default 0,
  event_count   integer not null default 0,
  is_bounce     boolean,
  device        text,
  browser       text,
  os            text,
  viewport_w    integer,
  viewport_h    integer,
  utm_source    text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  gclid         text, fbclid text,
  referrer      text, referrer_host text,
  geo_region    text,  -- grossier (en-têtes Vercel), IP jamais stockée
  geo_city      text,  -- grossier
  consent_state text,
  lead_id       uuid references public.leads(id) on delete set null,
  ua_hash       text   -- hash de l'UA, jamais l'UA brut
);
create index if not exists idx_analytics_sessions_visitor on public.analytics_sessions (visitor_id);
create index if not exists idx_analytics_sessions_started on public.analytics_sessions (started_at);
create index if not exists idx_analytics_sessions_gclid   on public.analytics_sessions (gclid) where gclid is not null;
create index if not exists idx_analytics_sessions_lead    on public.analytics_sessions (lead_id);

-- ── 2. Events ───────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.analytics_sessions(id) on delete cascade,
  visitor_id  uuid,
  ts          timestamptz not null default now(),
  ts_client   timestamptz,
  type        text not null,
  path        text,
  element     text,  -- sélecteur / texte tronqué / id — JAMAIS de valeur de champ
  meta        jsonb not null default '{}'::jsonb,
  constraint analytics_events_type_chk check (type in (
    'page_view','page_leave','scroll','click','rage_click','form_view',
    'field_focus','field_blur','field_change','form_step','form_submit',
    'form_abandon','custom'))
);
create index if not exists idx_analytics_events_session on public.analytics_events (session_id);
create index if not exists idx_analytics_events_pathtype on public.analytics_events (path, type);
create index if not exists idx_analytics_events_ts on public.analytics_events (ts);

-- ── 3. Replay chunks (rrweb) ────────────────────────────────────────────────
-- events en jsonb : compression transparente via TOAST côté Postgres.
create table if not exists public.analytics_replay_chunks (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.analytics_sessions(id) on delete cascade,
  seq         integer not null,
  ts          timestamptz not null default now(),
  events      jsonb not null,
  masked      boolean not null default true
);
create index if not exists idx_analytics_replay_session on public.analytics_replay_chunks (session_id, seq);

-- ── 4. Heatmap (agrégat quotidien, pas une matview : survit à la purge des
--      events bruts à 13 mois et évite de recalculer tout l'historique) ───────
create table if not exists public.analytics_heatmap_daily (
  day        date not null,
  path       text not null,
  device     text not null,
  vp_bucket  text not null,
  kind       text not null check (kind in ('click','scroll')),
  gx         smallint not null,
  gy         smallint not null,
  weight     integer not null default 0,
  primary key (day, path, device, vp_bucket, kind, gx, gy)
);

-- ── 5. Lien lead ↔ comportement (additif, rien retiré) ──────────────────────
alter table public.leads add column if not exists session_id uuid;
alter table public.leads add column if not exists visitor_id uuid;

-- ── 6. RLS : aucun accès anon ; lecture réservée authenticated (dashboard) ───
alter table public.analytics_sessions      enable row level security;
alter table public.analytics_events        enable row level security;
alter table public.analytics_replay_chunks enable row level security;
alter table public.analytics_heatmap_daily enable row level security;

drop policy if exists analytics_sessions_admin_read on public.analytics_sessions;
drop policy if exists analytics_events_admin_read on public.analytics_events;
drop policy if exists analytics_replay_admin_read on public.analytics_replay_chunks;
drop policy if exists analytics_heatmap_admin_read on public.analytics_heatmap_daily;

create policy analytics_sessions_admin_read on public.analytics_sessions
  for select to authenticated using (true);
create policy analytics_events_admin_read on public.analytics_events
  for select to authenticated using (true);
create policy analytics_replay_admin_read on public.analytics_replay_chunks
  for select to authenticated using (true);
create policy analytics_heatmap_admin_read on public.analytics_heatmap_daily
  for select to authenticated using (true);
-- (aucune policy anon : INSERT/SELECT direct interdits ; tout passe par les RPC SECURITY DEFINER)

-- ── 7. Ingestion (SECURITY DEFINER) — seule surface d'écriture exposée ───────
-- Calque de upsert_lead : la clé anon ne peut qu'appeler cette fonction validée.
-- La géo grossière est dérivée côté serveur (/api/track) ; l'IP n'arrive jamais ici.
create or replace function public.ingest_analytics(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s            jsonb := coalesce(payload->'session','{}'::jsonb);
  v_sid        uuid  := nullif(s->>'id','')::uuid;
  v_vid        uuid  := nullif(s->>'visitor_id','')::uuid;
  v_existing   public.analytics_sessions;
  ev           jsonb;
  rc           jsonb;
  v_count      int := 0;
  v_page_views int := coalesce((payload->>'page_views')::int, 0);
begin
  if v_sid is null or v_vid is null then
    return jsonb_build_object('ok', false, 'error', 'missing_ids');
  end if;
  -- anti-abus : on borne la taille des lots
  if jsonb_array_length(coalesce(payload->'events','[]'::jsonb)) > 200
     or jsonb_array_length(coalesce(payload->'replay','[]'::jsonb)) > 50 then
    return jsonb_build_object('ok', false, 'error', 'payload_too_large');
  end if;

  select * into v_existing from public.analytics_sessions where id = v_sid;

  if v_existing.id is null then
    insert into public.analytics_sessions (
      id, visitor_id, started_at, last_seen_at, entry_path,
      device, browser, os, viewport_w, viewport_h,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, fbclid, referrer, referrer_host, geo_region, geo_city,
      consent_state, ua_hash
    ) values (
      v_sid, v_vid, now(), now(), left(nullif(s->>'entry_path',''),512),
      nullif(s->>'device',''), nullif(s->>'browser',''), nullif(s->>'os',''),
      nullif(s->>'viewport_w','')::int, nullif(s->>'viewport_h','')::int,
      nullif(s->>'utm_source',''), nullif(s->>'utm_medium',''), nullif(s->>'utm_campaign',''),
      nullif(s->>'utm_term',''), nullif(s->>'utm_content',''),
      nullif(s->>'gclid',''), nullif(s->>'fbclid',''),
      left(nullif(s->>'referrer',''),512), nullif(s->>'referrer_host',''),
      nullif(s->>'geo_region',''), nullif(s->>'geo_city',''),
      nullif(s->>'consent_state',''), nullif(s->>'ua_hash','')
    );
  end if;

  -- events (liste blanche de types via le CHECK ; on ignore silencieusement le reste)
  for ev in select * from jsonb_array_elements(coalesce(payload->'events','[]'::jsonb))
  loop
    if (ev->>'type') in ('page_view','page_leave','scroll','click','rage_click','form_view',
        'field_focus','field_blur','field_change','form_step','form_submit','form_abandon','custom') then
      insert into public.analytics_events (session_id, visitor_id, ts, ts_client, type, path, element, meta)
      values (
        v_sid, v_vid, now(),
        nullif(ev->>'ts_client','')::timestamptz,
        ev->>'type',
        left(nullif(ev->>'path',''),512),
        left(nullif(ev->>'element',''),300),
        coalesce(ev->'meta','{}'::jsonb)
      );
      v_count := v_count + 1;
    end if;
  end loop;

  -- replay chunks rrweb
  for rc in select * from jsonb_array_elements(coalesce(payload->'replay','[]'::jsonb))
  loop
    insert into public.analytics_replay_chunks (session_id, seq, events, masked)
    values (v_sid, coalesce((rc->>'seq')::int,0), coalesce(rc->'events','[]'::jsonb),
            coalesce((rc->>'masked')::boolean, true));
  end loop;

  -- rollup session
  update public.analytics_sessions set
    last_seen_at  = now(),
    exit_path     = coalesce(left(nullif(s->>'exit_path',''),512), exit_path),
    page_count    = page_count + v_page_views,
    event_count   = event_count + v_count,
    duration_s    = greatest(coalesce(duration_s,0), coalesce((s->>'duration_s')::int,0)),
    is_bounce     = (page_count + v_page_views) <= 1,
    consent_state = coalesce(nullif(s->>'consent_state',''), consent_state)
  where id = v_sid;

  return jsonb_build_object('ok', true, 'events', v_count);
end;
$function$;

revoke all on function public.ingest_analytics(jsonb) from public;
grant execute on function public.ingest_analytics(jsonb) to anon, authenticated;

-- ── 8. Retrait du consentement : purge de la session du visiteur ─────────────
create or replace function public.purge_visitor_analytics(p_visitor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_n int;
begin
  if p_visitor_id is null then return jsonb_build_object('ok', false); end if;
  delete from public.analytics_sessions where visitor_id = p_visitor_id; -- cascade events + replay
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'sessions_deleted', v_n);
end;
$function$;
revoke all on function public.purge_visitor_analytics(uuid) from public;
grant execute on function public.purge_visitor_analytics(uuid) to anon, authenticated;

-- ── 9. upsert_lead : stocke aussi session_id / visitor_id (additif) ──────────
-- Lien lead ↔ comportement dès la capture progressive, sans rien changer d'autre.
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
      match_type, device, network, landing_path, referrer,
      session_id, visitor_id, updated_at
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
    where id = v_row.id
    returning * into v_row;
  end if;

  -- Lien retour : on rattache le lead à sa session comportementale (si connue)
  if v_row.session_id is not null then
    update public.analytics_sessions set lead_id = v_row.id where id = v_row.session_id and lead_id is null;
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
