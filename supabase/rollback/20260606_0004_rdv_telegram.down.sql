-- ROLLBACK Migration 4 — RDV + Telegram bidirectionnel
drop function if exists public.get_lead_for_rdv(uuid);
drop function if exists public.tg_set_status(uuid, text, text);
drop function if exists public.rdv_mark_sent(uuid);
drop function if exists public.rdv_save(jsonb);
drop function if exists public.set_lead_tg_message_id(uuid, bigint);
alter table public.leads
  drop column if exists telegram_message_id,
  drop column if exists traite_par;
-- NB : upsert_lead conserve la clé 'id' dans son retour (additif, sans effet de bord).
