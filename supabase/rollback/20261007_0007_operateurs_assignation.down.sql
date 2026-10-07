-- Rollback migration 7 : retire l'assignation, les RPC et la table des opérateurs.
drop function if exists public.set_lead_assignee(uuid, uuid, text);
drop function if exists public.get_lead_for_card(uuid);
drop index if exists public.leads_assigne_a_idx;
alter table public.leads drop column if exists assigne_a;
drop table if exists public.operateurs;
