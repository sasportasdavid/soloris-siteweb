-- Rollback migration 14 : retire la vue de diagnostic (v_devis_funnel n'a jamais été modifiée).
drop view if exists public.v_form_funnel;
