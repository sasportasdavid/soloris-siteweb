-- ROLLBACK Migration 3 — Confirmation de rendez-vous (Soloris)
alter table public.leads
  drop column if exists rdv_at,
  drop column if exists rdv_adresse,
  drop column if exists prestation,
  drop column if exists diagnostiqueur,
  drop column if exists prix_total_ttc,
  drop column if exists duree_estimee,
  drop column if exists consignes,
  drop column if exists confirmation_rdv_envoyee_at;
