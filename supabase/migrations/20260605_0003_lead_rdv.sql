-- ============================================================================
-- Migration 3 — Confirmation de rendez-vous (Soloris)
-- Additive sur public.leads (1 RDV par lead). Aucune donnée existante modifiée.
-- Remplace, côté flux commercial, le « devis à signer » par une confirmation de RDV.
-- Rollback : 20260605_0003_lead_rdv.down.sql
-- ============================================================================

alter table public.leads
  add column if not exists rdv_at                      timestamptz, -- date + heure du RDV
  add column if not exists rdv_adresse                 text,        -- adresse du bien (pré-remplie, éditable)
  add column if not exists prestation                  text,        -- objet (pré-rempli depuis les diagnostics du lead)
  add column if not exists diagnostiqueur              text,        -- nom du diagnostiqueur
  add column if not exists prix_total_ttc              numeric(10,2), -- prix tout compris convenu (éditable)
  add column if not exists duree_estimee               text,        -- optionnel
  add column if not exists consignes                   text,        -- optionnel (accès, clés, badge…)
  add column if not exists confirmation_rdv_envoyee_at timestamptz; -- idempotence de l'envoi
