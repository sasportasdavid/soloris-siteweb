-- ============================================================================
-- Migration 2 — Vues d'analyse + agrégat heatmap + rétention pg_cron (Soloris)
-- Additive. Vues en security_invoker (respectent la RLS) + grants authenticated.
-- Rollback : 20260604_0002_analytics_views_cron.down.sql
-- ============================================================================

-- Classification payant : helper réutilisé par les vues
create or replace function public.is_paid(p_gclid text, p_medium text)
returns boolean language sql immutable as $$
  select p_gclid is not null
      or lower(coalesce(p_medium,'')) in ('cpc','ppc','paid','paidsearch','paid_social','display');
$$;

-- ── Q1/Q2 : Funnel /devis par étape + dernier champ avant abandon ────────────
create or replace view public.v_devis_funnel with (security_invoker = true) as
with ds as (
  select s.id, s.gclid, s.utm_medium,
    bool_or(e.type = 'page_view' and e.path like '/devis%') as visited,
    bool_or(e.type = 'form_view')                            as form_view,
    bool_or(e.type in ('field_focus','field_change'))        as field_started,
    max(case when e.type = 'form_step' then (e.meta->>'step_index')::int end) as max_step,
    bool_or(e.type = 'form_submit')                          as submitted
  from public.analytics_sessions s
  join public.analytics_events e on e.session_id = s.id
  where exists (select 1 from public.analytics_events e2 where e2.session_id = s.id and e2.path like '/devis%')
  group by s.id, s.gclid, s.utm_medium
)
select
  case when public.is_paid(gclid, utm_medium) then 'payant' else 'organique' end as canal,
  count(*) filter (where visited)            as visites_devis,
  count(*) filter (where form_view)          as vues_formulaire,
  count(*) filter (where field_started)      as champ_commence,
  count(*) filter (where max_step >= 3)      as etape_estimation,
  count(*) filter (where max_step >= 5)      as etape_coordonnees,
  count(*) filter (where submitted)          as soumissions
from ds
group by 1;

create or replace view public.v_devis_dropoff_fields with (security_invoker = true) as
select coalesce(nullif(e.meta->>'last_field',''), '(inconnu)') as dernier_champ,
       count(*) as abandons,
       count(distinct e.session_id) as sessions
from public.analytics_events e
where e.type = 'form_abandon'
group by 1
order by abandons desc;

-- ── Q3 : Payant vs organique ─────────────────────────────────────────────────
create or replace view public.v_paid_vs_organic with (security_invoker = true) as
select
  case when public.is_paid(s.gclid, s.utm_medium) then 'payant' else 'organique' end as canal,
  count(*)                                                            as sessions,
  count(distinct s.visitor_id)                                       as visiteurs,
  round(avg(s.duration_s))                                           as duree_moy_s,
  round(avg(s.page_count), 2)                                        as pages_par_session,
  round(100.0 * count(*) filter (where s.is_bounce) / nullif(count(*),0), 1) as taux_rebond_pct,
  count(s.lead_id)                                                   as leads
from public.analytics_sessions s
group by 1;

-- ── Q3/top : Top pages (vues, durée, scroll moyen) + entrées/sorties ─────────
create or replace view public.v_top_pages with (security_invoker = true) as
select e.path,
  count(*) filter (where e.type = 'page_view')        as vues,
  count(distinct e.session_id)                        as sessions,
  round(avg((e.meta->>'time_on_page_s')::numeric) filter (where e.type = 'page_leave'), 1) as temps_moy_s,
  round(avg((e.meta->>'max_scroll')::numeric)   filter (where e.type = 'page_leave'), 1)   as scroll_moy_pct
from public.analytics_events e
where e.path is not null
group by e.path
order by vues desc;

create or replace view public.v_entry_exit_pages with (security_invoker = true) as
select 'entrée'::text as type, entry_path as path, count(*) as n
  from public.analytics_sessions where entry_path is not null group by entry_path
union all
select 'sortie'::text, exit_path, count(*)
  from public.analytics_sessions where exit_path is not null group by exit_path;

-- ── Q4 : Qualité géo — hors zone Paris(75)+93 ───────────────────────────────
create or replace view public.v_leads_hors_zone with (security_invoker = true) as
select l.id, l.created_at, l.secteur, l.type_demande, l.estimation, l.gclid, l.campaign,
       public.is_paid(l.gclid, l.medium) as payant
from public.leads l
where l.secteur is not null and left(l.secteur, 2) not in ('75','93');

create or replace view public.v_sessions_hors_idf with (security_invoker = true) as
select s.id, s.started_at, s.geo_region, s.geo_city, s.entry_path,
       (s.gclid is not null) as payant
from public.analytics_sessions s
where s.geo_region is not null
  and s.geo_region not ilike '%le-de-France%';  -- exclut « Île-de-France » / « Ile-de-France »

-- ── Q6 : Engagement quotidien + rage-clicks ─────────────────────────────────
create or replace view public.v_sessions_daily with (security_invoker = true) as
select date_trunc('day', s.started_at)::date as jour,
  count(*)                                       as sessions,
  count(distinct s.visitor_id)                   as visiteurs,
  round(avg(s.page_count), 2)                    as pages_par_session,
  round(avg(s.duration_s))                       as duree_moy_s,
  round(100.0 * count(*) filter (where s.is_bounce) / nullif(count(*),0), 1) as taux_rebond_pct,
  count(*) filter (where s.gclid is not null)    as sessions_payant
from public.analytics_sessions s
group by 1
order by 1 desc;

create or replace view public.v_rage_clicks with (security_invoker = true) as
select e.path, count(*) as rage_clicks, count(distinct e.session_id) as sessions
from public.analytics_events e
where e.type = 'rage_click' and e.path is not null
group by e.path
order by rage_clicks desc;

-- Grants : lecture réservée au rôle authenticated (dashboard), jamais anon
do $$
declare v text;
begin
  foreach v in array array[
    'v_devis_funnel','v_devis_dropoff_fields','v_paid_vs_organic','v_top_pages',
    'v_entry_exit_pages','v_leads_hors_zone','v_sessions_hors_idf','v_sessions_daily','v_rage_clicks'
  ] loop
    execute format('revoke all on public.%I from anon, public;', v);
    execute format('grant select on public.%I to authenticated;', v);
  end loop;
end $$;

-- ── Heatmaps : agrégation quotidienne (clics + profondeur de scroll) ─────────
create or replace function public.refresh_heatmap_daily(p_day date default (current_date - 1))
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_n int;
begin
  delete from public.analytics_heatmap_daily where day = p_day;

  -- Clics : grille 50 (x) × 200 (y) sur les coords relatives au document, par device
  insert into public.analytics_heatmap_daily(day, path, device, vp_bucket, kind, gx, gy, weight)
  select p_day, e.path,
         coalesce(nullif(e.meta->>'viewport',''),'c'),
         coalesce(nullif(e.meta->>'viewport',''),'c'),
         'click',
         least(49,  greatest(0, floor(coalesce((e.meta->>'x_rel')::numeric,0) * 50)::int)),
         least(199, greatest(0, floor(coalesce((e.meta->>'y_rel')::numeric,0) * 200)::int)),
         count(*)
  from public.analytics_events e
  where e.type in ('click','rage_click')
    and e.ts >= p_day and e.ts < p_day + 1
    and e.path is not null and e.meta ? 'x_rel'
  group by e.path, 3, 4,
           least(49,  greatest(0, floor(coalesce((e.meta->>'x_rel')::numeric,0) * 50)::int)),
           least(199, greatest(0, floor(coalesce((e.meta->>'y_rel')::numeric,0) * 200)::int));

  -- Profondeur de scroll : histogramme 0..100 par page (tous devices confondus)
  insert into public.analytics_heatmap_daily(day, path, device, vp_bucket, kind, gx, gy, weight)
  select p_day, e.path, 'all', 'all', 'scroll', 0,
         least(100, greatest(0, coalesce((e.meta->>'scroll_depth')::int,0))),
         count(*)
  from public.analytics_events e
  where e.type = 'scroll'
    and e.ts >= p_day and e.ts < p_day + 1
    and e.path is not null and e.meta ? 'scroll_depth'
  group by e.path, least(100, greatest(0, coalesce((e.meta->>'scroll_depth')::int,0)));

  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- ── Rétention : events/sessions ≤ 13 mois, replays ≤ 30 j (heatmaps conservées) ──
create or replace function public.purge_analytics_retention()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.analytics_replay_chunks where ts < now() - interval '30 days';
  delete from public.analytics_events       where ts < now() - interval '13 months';
  delete from public.analytics_sessions      where last_seen_at < now() - interval '13 months';
end;
$function$;

-- ── pg_cron : planification quotidienne ─────────────────────────────────────
create extension if not exists pg_cron;

do $$
begin
  -- Idempotent : on retire d'éventuels jobs homonymes avant de (re)planifier
  perform cron.unschedule(jobid) from cron.job
    where jobname in ('analytics_heatmap_daily','analytics_retention_purge');

  perform cron.schedule('analytics_heatmap_daily', '15 3 * * *',
    $cron$ select public.refresh_heatmap_daily(); $cron$);
  perform cron.schedule('analytics_retention_purge', '30 3 * * *',
    $cron$ select public.purge_analytics_retention(); $cron$);
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;
