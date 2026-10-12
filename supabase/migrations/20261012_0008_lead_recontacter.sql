-- ============================================================================
-- Migration 8 — Statut « à recontacter » : date de rappel sur le lead
-- Additif. Colonne `recontacter_le` (date du prochain rappel commercial),
-- éditée depuis le back-office. Le statut 'a_recontacter' est géré côté UI
-- (STATUTS), pas en base (la colonne statut reste libre en text).
-- ============================================================================
alter table public.leads
  add column if not exists recontacter_le date;
