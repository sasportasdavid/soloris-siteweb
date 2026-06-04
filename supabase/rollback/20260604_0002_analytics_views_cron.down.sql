-- ============================================================================
-- ROLLBACK Migration 2 — Vues d'analyse + heatmap + cron (Soloris)
-- ============================================================================

do $$
begin
  perform cron.unschedule(jobid) from cron.job
    where jobname in ('analytics_heatmap_daily','analytics_retention_purge');
exception when others then null;
end $$;

drop function if exists public.purge_analytics_retention();
drop function if exists public.refresh_heatmap_daily(date);

drop view if exists public.v_rage_clicks;
drop view if exists public.v_sessions_daily;
drop view if exists public.v_sessions_hors_idf;
drop view if exists public.v_leads_hors_zone;
drop view if exists public.v_entry_exit_pages;
drop view if exists public.v_top_pages;
drop view if exists public.v_paid_vs_organic;
drop view if exists public.v_devis_dropoff_fields;
drop view if exists public.v_devis_funnel;

drop function if exists public.is_paid(text, text);
