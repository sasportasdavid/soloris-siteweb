-- ============================================================================
-- Migration 14 — Vue de diagnostic du formulaire sur TOUTES les pages (audit formulaire 16/10/2026, §4)
-- v_devis_funnel (inchangée, conservée) ne retient que les sessions passées par /devis%, alors que
-- la majorité des formulaires sont vus sur /lp/dpe, /tarifs, /lp/vente-prix…
--
-- Sémantique des colonnes :
--   · vues_formulaire       : session avec un événement form_view (≥ 40 % du 1er formulaire visible) ;
--   · etape_franchie        : au moins un form_step (une étape validée) ;
--   · tentatives_envoi      : form_submit = TENTATIVE (clic sur l'envoi), pas un lead sauvegardé ;
--   · demandes_enregistrees : lead « complet » relié à la session (leads.session_id ou
--                             analytics_sessions.lead_id). Le lien n'existe que si le consentement
--                             « analyse » l'a permis : ce n'est PAS le total des demandes (table leads).
-- 100 % additif, lecture seule, security_invoker (RLS des tables sources), pas d'accès anon.
-- Rollback : 20261016_0014_v_form_funnel.down.sql
-- ============================================================================

create or replace view public.v_form_funnel
with (security_invoker = true) as
with ds as (
  select
    s.id,
    (s.started_at at time zone 'Europe/Paris')::date as jour,
    case when is_paid(s.gclid, s.utm_medium) then 'payant' else 'organique' end as canal,
    s.entry_path,
    bool_or(e.type = 'form_view')   as form_view,
    bool_or(e.type = 'form_step')   as etape,
    bool_or(e.type = 'form_submit') as tentative,
    exists (
      select 1 from public.leads l
      where l.lead_status = 'complet' and (l.session_id = s.id or l.id = s.lead_id)
    ) as lead_complet
  from public.analytics_sessions s
  left join public.analytics_events e on e.session_id = s.id
  group by s.id, s.started_at, s.gclid, s.utm_medium, s.entry_path, s.lead_id
)
select
  jour,
  canal,
  entry_path as page_entree,
  count(*)                                as sessions,
  count(*) filter (where form_view)       as vues_formulaire,
  count(*) filter (where etape)           as etape_franchie,
  count(*) filter (where tentative)       as tentatives_envoi,
  count(*) filter (where lead_complet)    as demandes_enregistrees
from ds
group by jour, canal, entry_path;

revoke all on public.v_form_funnel from anon, public;
grant select on public.v_form_funnel to authenticated, service_role;

comment on view public.v_form_funnel is
  'Entonnoir du formulaire de devis par jour, canal et page d''entrée (toutes pages). form_submit = tentative ; demandes_enregistrees = leads complets reliés à la session (consentement requis).';
